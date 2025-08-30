"use client";

import * as React from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useConfig,
} from "wagmi";
import { simulateContract } from "wagmi/actions";
import type { Abi, Hex } from "viem";
import {
  formatUnits,
  keccak256,
  encodePacked,
  concatHex,
} from "viem";
import DistributorAbi from "@/abi/MerkleDistributor.json";
import { BaseError } from "viem";

function getErrorMessage(e: unknown): string {
  if (!e) return "";
  // Viem/Wagmi errors
  if (e instanceof BaseError) return e.shortMessage || e.message;
  // Standard Error
  if (e instanceof Error) return e.message;
  // Plain object with message/shortMessage
  if (typeof e === "object") {
    const any = e as { message?: unknown; shortMessage?: unknown };
    if (typeof any.shortMessage === "string") return any.shortMessage;
    if (typeof any.message === "string") return any.message;
  }
  // Fallback
  return String(e);
}

type ClaimEntry = { account: `0x${string}`; amount: string; proof: `0x${string}`[] };
type ProofsFile = { round: number; root: `0x${string}`; claims: ClaimEntry[] };

const FILE_PATH = "/claims/current.json"; // <-- keep in sync with your builder
const DISTRIBUTOR = process.env.NEXT_PUBLIC_DISTRIBUTOR_ADDRESS as `0x${string}`;
const TOKEN = process.env.NEXT_PUBLIC_TOKEN_ADDRESS as `0x${string}`;

const erc20Abi = [
  { name: "decimals", stateMutability: "view", type: "function", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "balanceOf", stateMutability: "view", type: "function", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const satisfies Abi;

export default function ClaimPage() {
  const { address } = useAccount();
  const wagmiConfig = useConfig();

  const [proofs, setProofs] = React.useState<ProofsFile | null>(null);
  const [entry, setEntry] = React.useState<ClaimEntry | null>(null);

  // Fetch JSON (cache-busted) and log basics
  React.useEffect(() => {
    (async () => {
      try {
        const url = `${FILE_PATH}?v=${Date.now()}`;
        console.log("[claim] fetching file:", url);
        const r = await fetch(url, { cache: "no-store" });
        const j: ProofsFile = await r.json();
        console.log("[claim] file root:", j.root);
        console.log("[claim] claims count:", j.claims.length);
        setProofs(j);
      } catch (e) {
        console.error("[claim] failed to load proofs file", e);
        setProofs(null);
      }
    })();
  }, []);

  // Pick my entry
  React.useEffect(() => {
    if (!address || !proofs) { setEntry(null); return; }
    const me = proofs.claims.find(c => c.account.toLowerCase() === address.toLowerCase()) || null;
    console.log("[claim] connected:", address, "→ entry:", me ? { ...me, proofLen: me.proof.length } : null);
    setEntry(me);
  }, [address, proofs]);

  // On-chain reads
  const { data: decimals } = useReadContract({ address: TOKEN, abi: erc20Abi, functionName: "decimals" });
  const { data: onchainRoot } = useReadContract({
    address: DISTRIBUTOR, abi: DistributorAbi as Abi, functionName: "merkleRoot",
  });
  const { data: claimed } = useReadContract({
    address: DISTRIBUTOR,
    abi: DistributorAbi as Abi,
    functionName: "isClaimed",
    args: proofs && address ? [BigInt(proofs.round), address as `0x${string}`] : undefined,
  });
  const { data: distBal } = useReadContract({
    address: TOKEN,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [DISTRIBUTOR],
  });

  const human = entry && decimals != null ? formatUnits(BigInt(entry.amount), Number(decimals)) : null;

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: waiting, isSuccess } = useWaitForTransactionReceipt({ hash });

  async function claim() {
    if (!entry || !proofs) return;

    console.log("[claim] distributor:", DISTRIBUTOR);
    console.log("[claim] token      :", TOKEN);
    console.log("[claim] root(file) :", proofs.root);
    console.log("[claim] root(chain):", onchainRoot as string);
    console.log("[claim] entry      :", { ...entry, proofLen: entry.proof.length });

    // Shape checks
    if (!/^0x[0-9a-fA-F]{64}$/.test(proofs.root)) console.error("[claim] Bad root hex");
    if (!entry.proof.every(p => /^0x[0-9a-fA-F]{64}$/.test(p))) console.error("[claim] Bad proof element");

    // Send tx
    writeContract({
      address: DISTRIBUTOR,
      abi: DistributorAbi as Abi,
      functionName: "claim",
      args: [BigInt(proofs.round), address as `0x${string}`, BigInt(entry.amount), entry.proof],
    });
  }

  return (
    <div className="max-w-xl mx-auto space-y-4 pt-4">
      <h1 className="text-2xl font-bold">Claim MRT tokens</h1>

      {!address && <p>Connect your wallet to check eligibility.</p>}
      {address && !proofs && <p>Loading airdrop data…</p>}
      {address && proofs && !entry && <p>Not eligible for this airdrop.</p>}

      {address && entry && (
        <div className="rounded-xl border p-4 space-y-2">
          <div><b>Eligible:</b> {human ?? entry.amount} MRT</div>
          <div><b>Status:</b> {claimed ? "Already claimed" : (waiting || isPending ? "Claiming…" : "Unclaimed")}</div>

          <details className="text-xs">
            <summary>Show claim entry</summary>
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(entry, null, 2)}
            </pre>
          </details>

          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded bg-gray-800 text-white disabled:opacity-50"
              onClick={claim}
              disabled={!!claimed || isPending || waiting}
            >
              Claim
            </button>
          </div>

          {isSuccess && <div className="text-green-600">✅ Claimed!</div>}
          {error && <div className="text-red-600 text-sm">Error: {getErrorMessage(error)}</div>}
        </div>
      )}
    </div>
  );
}
