"use client";

import * as React from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import type { Abi } from "viem";
import {
  formatUnits,
} from "viem";
import DistributorAbi from "@/abi/MerkleDistributor.json";
import { BaseError } from "viem";

function fmtAmount(base: string, decimals: number, maxFrac = 6): string {
  const s = formatUnits(BigInt(base), decimals);
  const [i, f = ""] = s.split(".");
  const f2 = f.slice(0, maxFrac).replace(/0+$/, "");
  return f2 ? `${i}.${f2}` : i;
}

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

const FILE_PATH =
  process.env.NEXT_PUBLIC_CLAIMS_URL ?? "/claims/current.json";
console.log("[claim] FILE_PATH =", FILE_PATH);
const DISTRIBUTOR = process.env.NEXT_PUBLIC_DISTRIBUTOR_ADDRESS as `0x${string}`;
const TOKEN = process.env.NEXT_PUBLIC_TOKEN_ADDRESS as `0x${string}`;

const erc20Abi = [
  { name: "decimals", stateMutability: "view", type: "function", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "balanceOf", stateMutability: "view", type: "function", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const satisfies Abi;

export default function ClaimPage() {
  const { address } = useAccount();

  const [proofs, setProofs] = React.useState<ProofsFile | null>(null);
  const [entry, setEntry] = React.useState<ClaimEntry | null>(null);

  // Fetch JSON (cache-busted) and log basics
  React.useEffect(() => {
    (async () => {
      try {
        const url = `${FILE_PATH}?v=${Date.now()}`;
        console.log("[claim] fetching file:", url);
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) {
          console.error(`[claim] ${url} → HTTP ${r.status}`);
          setProofs(null);
          return;
        }
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

  const tokenDecimals = (typeof decimals === "number" ? decimals : 18);
  const pretty = entry ? fmtAmount(entry.amount, tokenDecimals) : null;

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

  function shorten(addr?: string, left = 6, right = 4) {
    if (!addr) return "";
    return addr.length > left + right + 2 ? `${addr.slice(0, left)}…${addr.slice(-right)}` : addr;
  }

  function Spinner() {
    return (
      <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z"/>
      </svg>
    );
  }

  function StatusBadge({ status }: { status: "idle" | "loading" | "not_eligible" | "claimed" | "claiming" | "ready" }) {
    const map = {
      idle:         { text: "Idle",          cls: "bg-zinc-800/60 text-zinc-300 border-zinc-700" },
      loading:      { text: "Loading data",  cls: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30" },
      not_eligible: { text: "Not eligible",  cls: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
      claimed:      { text: "Claimed",       cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
      claiming:     { text: "Claiming…",     cls: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30" },
      ready:        { text: "Ready",         cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
    } as const;
    const { text, cls } = map[status];
    return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>{text}</span>;
  }

  function Stat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-zinc-400">{label}</div>
        <div className="mt-1 text-lg font-semibold text-zinc-100">{value}</div>
      </div>
    );
  }

  function Banner({ children, tone = "info" as "info" | "success" | "error" } : { children: React.ReactNode; tone?: "info" | "success" | "error"; }) {
    const toneMap = {
      info:    "bg-sky-500/10 text-sky-300 border-sky-500/30",
      success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
      error:   "bg-rose-500/10 text-rose-300 border-rose-500/30",
    } as const;
    return <div className={`rounded-xl border px-3 py-2 text-sm ${toneMap[tone]}`}>{children}</div>;
  }

  function EmptyState({ title, subtitle, tone = "slate" }: { title: string; subtitle?: string; tone?: "slate" | "amber"; }) {
    const dot = tone === "amber" ? "bg-amber-400" : "bg-zinc-500";
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-center">
        <div className={`mx-auto mb-3 size-2 rounded-full ${dot}`} />
        <h3 className="font-semibold text-zinc-100">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
    );
  }

  function SkeletonBlock() {
    return (
      <div className="space-y-3">
        <div className="h-5 w-40 animate-pulse rounded bg-zinc-800" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-16 animate-pulse rounded-xl bg-zinc-800" />
          <div className="h-16 animate-pulse rounded-xl bg-zinc-800" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-xl bg-zinc-800" />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-black text-zinc-200 py-10 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
              Claim MRT
            </span>
          </h1>
          <p className="text-zinc-400 mt-1">
            Check your eligibility and claim your airdrop securely.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 shadow-2xl backdrop-blur-sm">
          <div className="p-5 sm:p-6 space-y-5">
            {/* Top state / address */}
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm text-zinc-400">
                <span className="inline-block size-2 rounded-full bg-emerald-400" />
                {address ? (
                  <span className="font-medium">
                    Connected: <span className="font-mono text-zinc-200">{shorten(address)}</span>
                  </span>
                ) : (
                  <span className="font-medium text-zinc-300">Wallet not connected</span>
                )}
              </span>

              <StatusBadge
                status={
                  !address
                    ? "idle"
                    : !proofs
                    ? "loading"
                    : !entry
                    ? "not_eligible"
                    : claimed
                    ? "claimed"
                    : (waiting || isPending)
                    ? "claiming"
                    : "ready"
                }
              />
            </div>

            {/* Content states */}
            {!address && (
              <EmptyState
                title="Connect your wallet"
                subtitle="We’ll check your eligibility automatically."
              />
            )}

            {address && !proofs && <SkeletonBlock />}

            {address && proofs && !entry && (
              <EmptyState
                title="Not eligible for this airdrop"
                subtitle="No claim entry was found for your address."
                tone="amber"
              />
            )}

            {address && entry && (
              <>
                {/* Amount & status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Stat label="Eligible amount" value={`${pretty ?? "…"} MRT`} />
                  <Stat
                    label="Status"
                    value={
                      claimed
                        ? "Already claimed"
                        : (waiting || isPending)
                        ? "Claiming…"
                        : "Unclaimed"
                    }
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={claim}
                    disabled={!!claimed || isPending || waiting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 bg-gradient-to-r from-indigo-500 to-fuchsia-600 hover:from-indigo-400 hover:to-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                    aria-busy={waiting || isPending}
                  >
                    {(waiting || isPending) && <Spinner />}
                    {claimed ? "Claimed" : "Claim"}
                  </button>

                  <p className="text-xs text-zinc-500">
                    Gas fees apply. Ensure you’re on the correct network.
                  </p>
                </div>

                {/* Success / Error */}
                {isSuccess && (
                  <Banner tone="success">✅ Claimed successfully! Your transaction will show up shortly.</Banner>
                )}
                {error && (
                  <Banner tone="error">
                    <b>Error:</b> {getErrorMessage(error)}
                  </Banner>
                )}

                {/* Debug details (collapsible) */}
                <details className="group rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm open:bg-zinc-900">
                  <summary className="cursor-pointer select-none font-medium text-zinc-200 marker:hidden outline-none">
                    <span className="inline-flex items-center gap-2">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 text-zinc-400 group-open:rotate-90 transition-transform">
                        <path fillRule="evenodd" d="M6.22 7.22a.75.75 0 011.06 0L10 9.94l2.72-2.72a.75.75 0 111.06 1.06L10.53 11.53a.75.75 0 01-1.06 0L6.22 8.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                      </svg>
                      Show claim entry (debug)
                    </span>
                  </summary>
                  <pre className="mt-3 whitespace-pre-wrap overflow-auto bg-black/60 p-3 rounded-lg border border-zinc-800 text-xs text-zinc-300">
  {JSON.stringify(entry, null, 2)}
                  </pre>
                </details>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

}
