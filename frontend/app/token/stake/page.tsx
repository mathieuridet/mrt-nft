"use client";

import * as React from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import type { Abi } from "viem";
import StakingAbi from "@/abi/SimpleStakingVault.json";
import { formatUnits, parseUnits } from "viem";

const STAKING = process.env.NEXT_PUBLIC_STAKING_ADDRESS as `0x${string}`;
const TOKEN   = process.env.NEXT_PUBLIC_TOKEN_ADDRESS as `0x${string}`;

const erc20Abi = [
  { name: "decimals", stateMutability: "view", type: "function", inputs: [], outputs: [{ type:"uint8" }] },
  { name: "balanceOf", stateMutability: "view", type: "function", inputs: [{name:"a",type:"address"}], outputs: [{type:"uint256"}] },
  { name: "allowance", stateMutability: "view", type: "function", inputs: [{name:"o",type:"address"},{name:"s",type:"address"}], outputs: [{type:"uint256"}] },
  { name: "approve", stateMutability: "nonpayable", type: "function", inputs: [{name:"s",type:"address"},{name:"a",type:"uint256"}], outputs: [{type:"bool"}] },
] as const satisfies Abi;

const stakingViewAbi = [
  { name:"balanceOf", stateMutability:"view", type:"function", inputs:[{name:"a",type:"address"}], outputs:[{type:"uint256"}] },
  { name:"earned", stateMutability:"view", type:"function", inputs:[{name:"a",type:"address"}], outputs:[{type:"uint256"}] },
] as const satisfies Abi;

export default function StakePage() {
  const { address } = useAccount();
  const [amount, setAmount] = React.useState("0");

  const { data: decimals } = useReadContract({ address: TOKEN, abi: erc20Abi, functionName: "decimals" });

  const { data: walletBal } = useReadContract({
    address: TOKEN, abi: erc20Abi, functionName: "balanceOf",
    args: address ? [address] : undefined, query: { enabled: !!address }
  });
  const { data: stakedBal } = useReadContract({
    address: STAKING, abi: stakingViewAbi, functionName: "balanceOf",
    args: address ? [address] : undefined, query: { enabled: !!address }
  });
  const { data: earned } = useReadContract({
    address: STAKING, abi: stakingViewAbi, functionName: "earned",
    args: address ? [address] : undefined, query: { enabled: !!address, refetchInterval: 5000 }
  });
  const { data: allowance } = useReadContract({
    address: TOKEN, abi: erc20Abi, functionName: "allowance",
    args: address ? [address, STAKING] : undefined, query: { enabled: !!address }
  });

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: waiting, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const needsApprove =
    !!decimals &&
    parseUnits(amount || "0", Number(decimals)) > (allowance as bigint ?? 0n);

  const doApprove = () => {
    if (!decimals) return;
    writeContract({
      address: TOKEN, abi: erc20Abi, functionName: "approve",
      args: [STAKING, parseUnits(amount, Number(decimals))]
    });
  };

  const doStake = () => {
    if (!decimals) return;
    writeContract({
      address: STAKING, abi: StakingAbi as Abi, functionName: "stake",
      args: [parseUnits(amount, Number(decimals))]
    });
  };

  const doUnstake = () => {
    if (!decimals) return;
    writeContract({
      address: STAKING, abi: StakingAbi as Abi, functionName: "withdraw",
      args: [parseUnits(amount, Number(decimals))]
    });
  };

  const doClaim = () => {
    writeContract({ address: STAKING, abi: StakingAbi as Abi, functionName: "getReward", args: [] });
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Stake TOKEN</h1>
      {!address && <p>Connect wallet to stake.</p>}

      {address && (
        <>
          <div className="rounded-xl border p-4 space-y-2">
            <div><b>Wallet:</b> {decimals!=null ? formatUnits((walletBal as bigint ?? 0n), Number(decimals)) : "…"}</div>
            <div><b>Staked:</b> {decimals!=null ? formatUnits((stakedBal as bigint ?? 0n), Number(decimals)) : "…"}</div>
            <div><b>Earned:</b> {decimals!=null ? formatUnits((earned as bigint ?? 0n), Number(decimals)) : "…"}</div>
          </div>

          <div className="rounded-xl border p-4 space-y-3">
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Amount"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              inputMode="decimal"
            />
            {needsApprove ? (
              <button className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
                      onClick={doApprove} disabled={isPending || waiting}>
                {isPending || waiting ? "Approving…" : "Approve"}
              </button>
            ) : (
              <button className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
                      onClick={doStake} disabled={isPending || waiting}>
                {isPending || waiting ? "Staking…" : "Stake"}
              </button>
            )}
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded border" onClick={doUnstake} disabled={isPending || waiting}>Unstake</button>
              <button className="px-4 py-2 rounded border" onClick={doClaim} disabled={isPending || waiting}>Claim rewards</button>
            </div>
            {isSuccess && <div className="text-green-600">✅ Tx confirmed: {txHash?.slice(0,10)}…</div>}
            {error && <div className="text-red-600 text-sm">Error: {String(error?.message || error)}</div>}
          </div>
        </>
      )}
    </div>
  );
}
