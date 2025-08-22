"use client";
import { useState, useMemo } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import abi from "./abi/MRTNFToken.json";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import NFTGrid from "./components/NFTGrid";

const addr = process.env.NEXT_PUBLIC_NFT_ADDRESS as `0x${string}`;

export default function Page() {
  const { address, isConnected } = useAccount();
  const [qty, setQty] = useState(1);
  const { data: price } = useReadContract({ address: addr, abi, functionName: "mintPrice" });
  const { data: max } = useReadContract({ address: addr, abi, functionName: "MAX_SUPPLY" });
  const { data: supply } = useReadContract({ address: addr, abi, functionName: "totalSupply" });
  const { writeContractAsync, isPending } = useWriteContract();
  const { data: balance } = useReadContract({
      address: addr,
      abi,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
      query: { enabled: !!address && isConnected },
    });

  const cost = useMemo(() => price ? (BigInt(price as string) * BigInt(qty)).toString() : "0", [price, qty]);

  async function onMint() {
    await writeContractAsync({
      address: addr,
      abi,
      functionName: "mint",
      args: [BigInt(qty)],
      value: BigInt(cost),
    });
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900 text-neutral-100">
      <div className="mx-auto max-w-xl px-6 py-10">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">MRTNFT Mint</h1>
          <ConnectButton chainStatus="icon" showBalance={false} />
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
          <div className="space-y-2 text-sm">
            <p className="truncate">
              <span className="text-neutral-400">Contract:</span>{" "}
              <span className="font-mono">{addr}</span>
            </p>
            <p>
              <span className="text-neutral-400">Supply:</span>{" "}
              {(supply)?.toString() ?? "-"} / {(max)?.toString() ?? "-"}
            </p>
            <p>
              <span className="text-neutral-400">Price:</span>{" "}
              {price ? `${Number(price) / 1e18} ETH` : "-"}
            </p>
          </div>

          {isConnected ? (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-[auto,1fr,auto]">
                <label
                  htmlFor="qty"
                  className="self-center text-sm text-neutral-400"
                >
                  Quantity
                </label>
                <input
                  id="qty"
                  type="number"
                  min={1}
                  max={10}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                  className="w-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-right font-mono outline-none ring-0 transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40"
                />
                <button
                  disabled={!price || isPending}
                  onClick={onMint}
                  className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 font-medium transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? "Minting..." : `Mint ${qty}`}
                </button>
              </div>

              <p className="mt-4 text-sm text-neutral-400">
                Total cost:{" "}
                <span className="font-mono text-neutral-100">
                  {price ? (Number(price) * qty) / 1e18 : 0} ETH
                </span>
              </p>

              <br/>
              <p className="mt-2 text-xs text-neutral-500">
                Connected: <code className="font-mono">{address}</code>
              </p>
              <p className="mt-2 text-neutral-400">
                My NFTs ({(balance ?? 0).toString()})
              </p>
              <NFTGrid owner={address} network="eth-sepolia" />
            </>
          ) : (
            <p className="mt-6 text-sm text-neutral-400">
              Connect your wallet to mint.
            </p>
          )}
        </section>
      </div>
    </main>
);

}
