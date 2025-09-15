"use client";
import { useState, useMemo } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import abi from "../../abi/MRTNFToken.json";
import NFTGrid from "../components/NFTGrid";
import { EmptyState } from "@/app/components/Helpers";

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
    <div className="min-h-screen bg-black text-zinc-200 py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
              Mint MRTNFT
            </span>
          </h1>
          <p className="text-zinc-400 mt-1">
            Mint your MRT NFT directly from the contract.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 shadow-2xl backdrop-blur-sm">
          <div className="p-5 sm:p-6 space-y-5">
            <div className="space-y-1 text-sm">
              <p className="truncate">
                <span className="text-zinc-400">Contract:</span>{" "}
                <span className="font-mono text-zinc-200">{addr}</span>
              </p>
              <p>
                <span className="text-zinc-400">Supply:</span>{" "}
                {(supply ?? "-").toString()} / {(max ?? "-").toString()}
              </p>
              <p>
                <span className="text-zinc-400">Price:</span>{" "}
                {price ? `${Number(price) / 1e18} ETH` : "-"}
              </p>
            </div>

            {!isConnected && (
              <EmptyState
                title="Connect your wallet"
                subtitle="You need to connect your wallet to mint NFTs."
              />
            )}

            {isConnected && (
              <>
                <div className="grid gap-3 sm:grid-cols-[auto,1fr,auto] items-center">
                  <label
                    htmlFor="qty"
                    className="text-sm text-zinc-400"
                  >
                    Quantity
                  </label>
                  <input
                    id="qty"
                    type="number"
                    min={1}
                    max={10}
                    value={qty}
                    onChange={(e) =>
                      setQty(Math.max(1, Number(e.target.value)))
                    }
                    className="w-24 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-right font-mono text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                  />
                  <button
                    disabled={!price || isPending}
                    onClick={onMint}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 bg-gradient-to-r from-indigo-500 to-fuchsia-600 hover:from-indigo-400 hover:to-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                    aria-busy={isPending}
                  >
                    {isPending ? "Minting…" : `Mint ${qty}`}
                  </button>
                </div>

                <p className="text-sm text-zinc-400">
                  Total cost:{" "}
                  <span className="font-mono text-zinc-200">
                    {price ? (Number(price) * qty) / 1e18 : 0} ETH
                  </span>
                </p>

                <div className="pt-3 space-y-2 text-xs text-zinc-500">
                  <p className="text-zinc-400">
                    My NFTs ({(balance ?? 0).toString()})
                  </p>
                </div>

                <NFTGrid owner={address} network="eth-sepolia" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

}
