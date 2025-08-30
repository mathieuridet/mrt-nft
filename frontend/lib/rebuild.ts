// frontend/lib/rebuild.ts
//
// Recomputes Merkle proofs for "addresses that minted an NFT in the last hour",
// writes current.json (locally in dev, Blob in prod), and pushes the root on-chain
// when it changed.
//
// ENV you likely need (Vercel > Settings > Environment Variables):
//   SEPOLIA_RPC_URL          - RPC URL (Alchemy/Infura) for Sepolia
//   NFT_ADDRESS              - your ERC-721 contract address
//   DISTRIBUTOR_ADDRESS      - HourlyMerkleDistributorV2 address
//   PRIVATE_KEY              - owner key that can call setRoot (server-side only)
//   REWARD_AMOUNT            - fallback (human) if on-chain rewardAmount == 0, e.g. "5"
//   BLOCKS_PER_HOUR          - window size; default 300 (≈ 1h on Sepolia)
//   BLOB_READ_WRITE_TOKEN    - (optional) Vercel Blob token if not auto-wired
//   NEXT_PUBLIC_CLAIMS_URL   - (frontend) https://<proj>.blob.vercel-storage.com/claims/current.json
//   WRITE_LOCAL=1            - force writing local file even in production
//
// Usage (from a Next.js API route or a Node script):
//   import { rebuildAndPush } from "@/lib/rebuild";
//   const res = await rebuildAndPush();

import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import { ethers, JsonRpcProvider, Wallet, Contract } from "ethers";

type RebuildOptions = {
  rpcUrl?: string;
  nft?: `0x${string}`;
  distributor?: `0x${string}`;
  blocksPerHour?: number;
  outPath?: string;           // local path (for dev)
  blobKey?: string;           // remote blob key (path) e.g. "claims/current.json"
  pk?: string;                // private key to call setRoot (server-side)
};

type RebuildResult = {
  ok: boolean;
  updated: boolean;
  reason?: "empty" | "unchanged" | "no-signer" | "pushed";
  txHash?: string;
  count: number;
  round: number;
  fileRoot: `0x${string}`;
  onchainRoot?: `0x${string}`;
  blobUrl?: string;
  localPath?: string;
  warn?: string[];
};

type Claim = {
  account: `0x${string}`;
  amount: string;              // wei as string
  proof: `0x${string}`[];
};

type ProofsPayload = {
  round: number;
  root: `0x${string}`;
  claims: Claim[];
};

const DIST_ABI = [
  "function token() view returns (address)",
  "function merkleRoot() view returns (bytes32)",
  "function round() view returns (uint64)",
  "function rewardAmount() view returns (uint256)",
  "function setRoot(bytes32,uint64) external",
] as const;

const TRANSFER_SIG = ethers.id("Transfer(address,address,uint256)");
const ZERO_TOPIC = ethers.zeroPadValue(ethers.ZeroAddress, 32);

function leafHash(account: `0x${string}`, amount: bigint, round: bigint) {
  return ethers.keccak256(
    ethers.solidityPacked(["address", "uint256", "uint64"], [account, amount, round])
  );
}
function toBuf(hex: string) {
  return Buffer.from(hex.slice(2), "hex");
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}

export async function rebuildAndPush(opts: RebuildOptions = {}): Promise<RebuildResult> {
  const warns: string[] = [];

  const rpcUrl =
    opts.rpcUrl ?? process.env.NEXT_PUBLIC_RPC_URL ?? "";
  const nft = (opts.nft ?? process.env.NEXT_PUBLIC_NFT_ADDRESS) as `0x${string}`;
  const distributor = (opts.distributor ?? process.env.NEXT_PUBLIC_DISTRIBUTOR_ADDRESS) as `0x${string}`;
  const blocksPerHour = opts.blocksPerHour ?? Number(process.env.BLOCKS_PER_HOUR ?? 300);
  const outPath =
    opts.outPath ?? path.join(process.cwd(), "public", "claims", "current.json");
  const blobKey = opts.blobKey ?? "claims/current.json";
  const pk = opts.pk ?? process.env.PRIVATE_KEY;

  if (!rpcUrl || !nft || !distributor) {
    return {
      ok: false,
      updated: false,
      count: 0,
      round: 0,
      fileRoot: ZERO_TOPIC,
      warn: warns.concat("Missing RPC/NFT/DISTRIBUTOR env"),
    };
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const code = await provider.getCode(distributor);
  if (code === "0x") {
    return {
      ok: false,
      updated: false,
      count: 0,
      round: 0,
      fileRoot: ZERO_TOPIC,
      warn: warns.concat(`No contract bytecode at ${distributor}`),
    };
  }

  // signer optional: if not present we'll still write file but skip setRoot
  const signer = pk ? new Wallet(pk, provider) : undefined;

  const dist = new Contract(distributor, DIST_ABI, signer ?? provider);

  const [onchainRoot, onchainRound, onchainReward] = await Promise.all([
    dist.merkleRoot(),
    dist.round(),
    dist.rewardAmount(),
  ]) as [`0x${string}`, bigint, bigint];

  let rewardAmount = onchainReward;
  if (rewardAmount === 0n) {
    const fallback = ethers.parseUnits(process.env.REWARD_AMOUNT || "5", 18);
    warns.push(
      `On-chain rewardAmount is 0; using fallback ${fallback.toString()} wei from REWARD_AMOUNT (claims will only succeed if contract expects the same amount).`
    );
    rewardAmount = fallback;
  }

  // Find mints in the last "hour" window
  const toBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, toBlock - blocksPerHour);

  const logs = await provider.getLogs({
    address: nft,
    fromBlock,
    toBlock,
    topics: [TRANSFER_SIG, ZERO_TOPIC], // topic1 = from == 0x0
  });

  const minters = new Set<string>();
  for (const log of logs) {
    // topic2 is indexed "to"
    const to = ethers.getAddress(("0x" + log.topics[2].slice(26)) as `0x${string}`);
    minters.add(to.toLowerCase());
  }

  const round = BigInt(Math.floor(Date.now() / 1000 / 3600));
  const addresses = Array.from(minters).sort();

  // Decide outputs & destinations
  const isVercel = !!process.env.VERCEL;
  const isProd = process.env.NODE_ENV === "production";
  const shouldWriteLocal =
    process.env.WRITE_LOCAL === "1" || !isVercel || !isProd; // write locally in dev or when forced
  const shouldUseBlob = isVercel || !!process.env.BLOB_READ_WRITE_TOKEN;

  // If empty set → write zero-root file, try to upload, but SKIP setRoot
  if (addresses.length === 0) {
    const payload: ProofsPayload = {
      round: Number(round),
      root: ZERO_TOPIC,
      claims: [],
    };
    let blobUrl: string | undefined;
    let localPath: string | undefined;

    if (shouldWriteLocal) {
      try {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
        localPath = outPath;
      } catch (e) {
        warns.push(`Local write failed: ${errorMessage(e)}`);
      }
    }
    if (shouldUseBlob) {
      try {
        const res = await put(blobKey, JSON.stringify(payload, null, 2), {
          access: "public",
          addRandomSuffix: false,
          contentType: "application/json",
          token: process.env.BLOB_READ_WRITE_TOKEN, // omit if Integration is wired
        });
        blobUrl = res.url;
        console.log("Blob URL:", blobUrl);
      } catch (e) {
        warns.push(`Blob upload failed: ${errorMessage(e)}`);
      }
    }

    return {
      ok: true,
      updated: false,
      reason: "empty",
      count: 0,
      round: Number(round),
      fileRoot: ZERO_TOPIC,
      onchainRoot,
      blobUrl,
      localPath,
      warn: warns.length ? warns : undefined,
    };
  }

  // Build Merkle
  const leaves = addresses.map((a) =>
    toBuf(leafHash(a as `0x${string}`, rewardAmount, round))
  );
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const fileRoot = ("0x" + tree.getRoot().toString("hex")) as `0x${string}`;
  const claims = addresses.map((account, i) => ({
    account,
    amount: rewardAmount.toString(),
    proof: tree.getHexProof(leaves[i]) as `0x${string}`[],
  }));

  // Write JSON (local & blob)
  let blobUrl: string | undefined;
  let localPath: string | undefined;

  const payloadStr = JSON.stringify(
    { round: Number(round), root: fileRoot, claims },
    null,
    2
  );

  if (shouldWriteLocal) {
    try {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, payloadStr);
      localPath = outPath;
    } catch (e) {
      warns.push(`Local write failed: ${errorMessage(e)}`);
    }
  }

  if (shouldUseBlob) {
    try {
      const res = await put(blobKey, payloadStr, {
        access: "public",
        addRandomSuffix: false,
        contentType: "application/json",
        token: process.env.BLOB_READ_WRITE_TOKEN, // omit if Integration is wired
      });
      blobUrl = res.url;
    } catch (e) {
      warns.push(`Blob upload failed: ${errorMessage(e)}`);
    }
  }

  // Decide if we need to push new root/round
  const needUpdate =
    fileRoot.toLowerCase() !== (onchainRoot as string).toLowerCase() ||
    round > onchainRound;

  if (!needUpdate) {
    return {
      ok: true,
      updated: false,
      reason: "unchanged",
      count: addresses.length,
      round: Number(round),
      fileRoot,
      onchainRoot,
      blobUrl,
      localPath,
      warn: warns.length ? warns : undefined,
    };
  }

  if (!signer) {
    return {
      ok: true,
      updated: false,
      reason: "no-signer",
      count: addresses.length,
      round: Number(round),
      fileRoot,
      onchainRoot,
      blobUrl,
      localPath,
      warn: warns.concat(
        "No PRIVATE_KEY provided; wrote proofs but skipped setRoot"
      ),
    };
  }

  // Push on-chain
  const tx = await dist.setRoot(fileRoot, round);
  const rcpt = await tx.wait();

  return {
    ok: true,
    updated: true,
    reason: "pushed",
    txHash: rcpt?.hash,
    count: addresses.length,
    round: Number(round),
    fileRoot,
    onchainRoot,
    blobUrl,
    localPath,
    warn: warns.length ? warns : undefined,
  };
}
