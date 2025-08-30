import { ethers } from "hardhat";
import fs from "node:fs";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

// ENV:
//   SEPOLIA_RPC_URL     - your RPC (already used by Hardhat)
//   NFT_ADDRESS         - your ERC721
//   REWARD_AMOUNT       - human units, default "5"
//   BLOCKS_PER_HOUR     - optional (default 300)

const OUTPUT = "./frontend/public/claims/current.json";

function toBuf(hex: string) {
  return Buffer.from(hex.slice(2), "hex");
}

function leafHash(account: `0x${string}`, amount: bigint, round: bigint) {
  return ethers.keccak256(
    ethers.solidityPacked(["address", "uint256", "uint64"], [account, amount, round])
  );
}

async function main() {
  const NFT = process.env.NFT_ADDRESS as `0x${string}`;
  if (!NFT) throw new Error("Set NFT_ADDRESS in .env");

  const provider = ethers.provider;
  const net = await provider.getNetwork();
  console.log("Chain:", net.name, net.chainId.toString());

  const rewardHuman = process.env.REWARD_AMOUNT || "5";
  const rewardWei = ethers.parseUnits(rewardHuman, 18); // MRT is 18 decimals
  console.log("Reward amount (wei):", rewardWei.toString());

  const BLOCKS_PER_HOUR = Number(process.env.BLOCKS_PER_HOUR || 300);
  const toBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, toBlock - BLOCKS_PER_HOUR);
  console.log(`Scanning mints for NFT ${NFT} from block ${fromBlock} to ${toBlock} ...`);

  const TRANSFER_SIG = ethers.id("Transfer(address,address,uint256)");
  const ZERO_32 = "0x" + "00".repeat(32);

  const logs = await provider.getLogs({
    address: NFT,
    fromBlock, toBlock,
    topics: [TRANSFER_SIG, ZERO_32], // from == 0x0 (mint)
  });

  const addrs = new Set<string>();
  for (const log of logs) {
    const to = ethers.getAddress(("0x" + log.topics[2].slice(26)) as `0x${string}`);
    addrs.add(to.toLowerCase());
  }

  const round = BigInt(Math.floor(Date.now() / 1000 / 3600));
  console.log("Round:", round.toString(), "| unique minters last hour:", addrs.size);

  const addresses = Array.from(addrs).sort();
  const leaves = addresses.map(a => toBuf(leafHash(a as `0x${string}`, rewardWei, round)));

  // Handle empty set explicitly
  let root: `0x${string}`;
  let proofs: `0x${string}`[][] = [];
  if (leaves.length === 0) {
    root = ("0x" + "00".repeat(64)) as `0x${string}`; // bytes32(0)
    proofs = [];
  } else {
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    root = ("0x" + tree.getRoot().toString("hex")) as `0x${string}`;
    proofs = leaves.map((leaf) => tree.getHexProof(leaf) as `0x${string}`[]);
  }

  const claims = addresses.map((account, i) => ({
    account,
    amount: rewardWei.toString(),
    proof: proofs[i] || [],
  }));

  fs.mkdirSync("./frontend/public/claims", { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify({ round: Number(round), root, claims }, null, 2));
  console.log("Wrote:", OUTPUT);
  console.log("File root:", root);
}

main().catch((e) => { console.error(e); process.exit(1); });
