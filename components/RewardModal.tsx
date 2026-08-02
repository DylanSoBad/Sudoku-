"use client";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { explorerTxUrl, formatMs } from "@/lib/utils";
import { rewardFor } from "@/lib/tokenomics";

export interface RewardModalProps {
  open: boolean;
  onClose: () => void;
  level: number;
  ms: number;
  hints: number;
  txHash?: string;
}

export function RewardModal({ open, onClose, level, ms, hints, txHash }: RewardModalProps) {
  const reward = rewardFor(level);
  return (
    <Dialog open={open} onClose={onClose} title={`Level ${level} solved`}>
      <p className="text-sm text-shelby-muted">
        Time {formatMs(ms)} · {hints} hint{hints === 1 ? "" : "s"}
      </p>
      <div className="my-4 rounded-lg border border-shelby-accent/30 bg-shelby-accent/10 p-3 text-center">
        <div className="text-3xl font-bold text-shelby-accent2">+{reward.toFixed(2)} sUSD</div>
        <div className="mt-1 text-xs text-shelby-muted">
          {txHash ? "On-chain via rewards::claim" : "Local credit (Move registry not configured)"}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {txHash && (
          <a
            className="text-xs text-shelby-accent2 underline"
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noreferrer"
          >
            view tx
          </a>
        )}
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button onClick={onClose}>Continue</Button>
      </div>
    </Dialog>
  );
}