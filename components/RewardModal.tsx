"use client";

import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { explorerTxUrl, formatMs } from "@/lib/utils";
import { rewardFor, MAX_LEVEL } from "@/lib/tokenomics";
import { markCleared } from "@/lib/progress";
import { useRouter } from "next/navigation";
import type { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { registryAddress, waitForTxSuccess } from "@/lib/aptos";

export interface RewardModalProps {
  open: boolean;
  onClose: () => void;
  level: number;
  ms: number;
  hints: number;
  txHash?: string;
}

export function RewardModal({ open, onClose, level, ms, hints, txHash }: RewardModalProps) {
  const router = useRouter();
  const { account, signAndSubmitTransaction } = useWallet();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimTxHash, setClaimTxHash] = useState<string | undefined>(txHash);
  const [claimError, setClaimError] = useState<string | undefined>(undefined);

  const reward = rewardFor(level);
  const registry = registryAddress();
  const isLastLevel = level >= MAX_LEVEL;

  async function handleClaim() {
    if (!account) return;
    if (!registry) {
      setClaimError("NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS is not set");
      return;
    }
    setClaiming(true);
    setClaimError(undefined);
    try {
      const txInput: InputTransactionData = {
        data: {
          function: `${registry}::rewards::claim`,
          typeArguments: [],
          functionArguments: [level],
        },
      };
      const pending = await signAndSubmitTransaction(txInput);
      await waitForTxSuccess(pending.hash);
      setClaimed(true);
      setClaimTxHash(pending.hash);
      // Persist HMAC progress unlocking level N+1 only after success.
      await markCleared(account.address, level);
      window.dispatchEvent(new CustomEvent("shelby:balances"));
    } catch (e) {
      setClaimError((e as Error).message ?? "Transaction failed");
    } finally {
      setClaiming(false);
    }
  }

  async function handleNextLevel() {
    if (account?.address) {
      await markCleared(account.address, level);
    }
    onClose();
    if (isLastLevel) {
      router.push("/");
    } else {
      router.push(`/level/${level + 1}`);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Level ${level} complete`}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-shelby-muted">
          Time {formatMs(ms)} · {hints} hint{hints === 1 ? "" : "s"}
        </p>

        <div className="rounded-lg border border-shelby-accent/30 bg-shelby-accent/10 p-3 text-center">
          <div className="text-3xl font-bold text-shelby-accent2">+{reward.toFixed(2)} sUSD</div>
          <div className="mt-1 text-xs text-shelby-muted">
            {claimTxHash
              ? "Claimed on-chain"
              : claimed
                ? "Claimed on-chain"
                : registry
                  ? "Ready to claim on-chain"
                  : "Move registry not configured"}
          </div>
        </div>

        {claimError && (
          <div className="rounded border border-shelby-danger/30 bg-shelby-danger/10 px-3 py-2 text-xs text-shelby-danger">
            {claimError}
          </div>
        )}

        {registry && account && !claimed ? (
          <Button onClick={handleClaim} disabled={claiming} className="w-full">
            {claiming ? "Claiming…" : "Claim reward on-chain"}
          </Button>
        ) : !claimed ? (
          <Button disabled className="w-full opacity-60">
            {registry && !account ? "Connect wallet to claim" : "Move registry not configured"}
          </Button>
        ) : null}

        {claimed && (
          <Button disabled className="w-full opacity-60">
            Reward credited ✓
          </Button>
        )}

        {claimTxHash && (
          <a
            className="text-center text-xs text-shelby-accent2 underline"
            href={explorerTxUrl(claimTxHash)}
            target="_blank"
            rel="noreferrer"
          >
            view tx on explorer
          </a>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => { onClose(); router.push("/"); }} className="flex-1">
            Back to levels
          </Button>
          <Button onClick={handleNextLevel} className="flex-1">
            {isLastLevel ? "All done!" : "Next level →"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
