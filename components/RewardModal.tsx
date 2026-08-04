"use client";

import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { explorerTxUrl, formatMs } from "@/lib/utils";
import { REWARD_PER_LEVEL_SUSD, MAX_LEVEL } from "@/lib/tokenomics";
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

export function RewardModal({ open, onClose, level, ms, hints, txHash }: RewardModalProps) {
  const router = useRouter();
  const { account, signAndSubmitTransaction } = useWallet();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(Boolean(txHash));
  const [claimTxHash, setClaimTxHash] = useState<string | undefined>(txHash);
  const [claimError, setClaimError] = useState<string | undefined>(undefined);

  const registry = registryAddress();
  const isLastLevel = level >= MAX_LEVEL;

  function goNext() {
    onClose();
    router.push(isLastLevel ? "/" : `/play/${level + 1}`);
  }

  async function handleClaimAndNext() {
    if (claimed) {
      goNext();
      return;
    }
    if (!account) {
      setClaimError("Connect a wallet to claim");
      return;
    }
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
      goNext();
    } catch (e) {
      setClaimError((e as Error).message ?? "Transaction failed");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Level ${pad2(level)} solved`}>
      <div className="flex flex-col gap-5">
        <p className="-mt-2 font-mono text-xs text-content-muted">
          {formatMs(ms)} · {hints} hint{hints === 1 ? "" : "s"}
        </p>

        <div className="font-mono text-3xl text-accent-hover">
          +{REWARD_PER_LEVEL_SUSD.toFixed(3)} sUSD
        </div>

        {claimError && (
          <p className="text-xs text-danger">{claimError}</p>
        )}

        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => {
              onClose();
              router.push("/");
            }}
          >
            Back
          </Button>
          <Button className="flex-1" onClick={handleClaimAndNext} disabled={claiming}>
            {claiming ? "Claiming" : claimed ? "Next" : "Claim + Next"}
          </Button>
        </div>

        {claimTxHash && (
          <a
            className="font-mono text-xs text-content-subtle transition-colors duration-100 hover:text-content-muted"
            href={explorerTxUrl(claimTxHash)}
            target="_blank"
            rel="noreferrer"
          >
            tx: {shortHash(claimTxHash)}
          </a>
        )}
      </div>
    </Dialog>
  );
}
