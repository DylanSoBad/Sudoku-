"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Trophy, Loader2, ArrowRight, Play } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildClaimRewardPayload } from "@/lib/contracts";
import { getAptosClient } from "@/lib/balances";
import { getLevelMeta, type Board, type Difficulty } from "@/lib/sudoku";
import { markLevelComplete } from "@/components/level-map";
import { computeSolutionMerkle, isSolveTooFast, minSolveSeconds } from "@/lib/anticheat";
import { recordLocalLeaderboardEntry } from "@/lib/leaderboard";
import { recordSolveStreak } from "@/lib/streak";
import {
  lookupReplayBlobName,
  uploadSolveReplay,
  type ReplayMove,
} from "@/lib/replay";
import { useT } from "@/components/app-providers";

export interface RewardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level: number;
  sessionId: string;
  puzzle: Board;
  solution: Board;
  elapsedSec: number;
  hintsUsed: number;
  moves: ReplayMove[];
  difficulty: Difficulty;
  isDaily?: boolean;
  rewardOverride?: number;
  onClaimed?: (replayBlobName: string | null) => void;
}

export function RewardModal({
  open,
  onOpenChange,
  level,
  sessionId,
  puzzle,
  solution,
  elapsedSec,
  hintsUsed,
  moves,
  difficulty,
  isDaily = false,
  rewardOverride,
  onClaimed,
}: RewardModalProps) {
  const t = useT();
  const { account, connected, signAndSubmitTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [replayId, setReplayId] = useState<string | null>(null);
  const meta = getLevelMeta(level);
  const reward = rewardOverride ?? meta.reward;
  const nextLevel = level + 1;
  const addr = account?.address?.toString() ?? "guest";
  const replayLevel = isDaily ? 0 : level;

  useEffect(() => {
    if (open) {
      setClaimed(false);
      const existing = lookupReplayBlobName(replayLevel, addr);
      setReplayId(existing);
    }
  }, [level, open, addr, replayLevel]);

  const uploadReplay = async (): Promise<string | null> => {
    const createdAt = Date.now();
    const replay = {
      v: 1 as const,
      addr,
      level: replayLevel,
      puzzle,
      solution,
      moves,
      createdAt,
      hintsUsed,
      timeMs: elapsedSec * 1000,
    };

    const signer =
      connected && account
        ? {
            address: account.address.toString(),
            signAndSubmitTransaction: async (payload: unknown) => {
              const p = payload as { data?: Record<string, unknown>; function?: string };
              const payloadData = p.data ?? (p as { function: string });
              const result = await signAndSubmitTransaction(payloadData as never);
              return { hash: result.hash };
            },
          }
        : null;

    const result = await uploadSolveReplay(replay, signer);
    if (result.source === "local") {
      toast.message("Replay saved locally", {
        description: "Connect wallet + Shelby SDK to upload to Shelby",
      });
    }
    setReplayId(result.blobName);
    return result.blobName;
  };

  const claim = async () => {
    if (isSolveTooFast(elapsedSec, difficulty)) {
      toast.error(
        `Solve too fast — minimum ${minSolveSeconds(difficulty)}s for ${difficulty}`,
      );
      return;
    }

    if (!connected || !account) {
      toast.error("Connect a wallet to claim rewards");
      return;
    }

    setLoading(true);
    try {
      let claimedOnChain = false;
      const merkle = await computeSolutionMerkle(puzzle, solution, hintsUsed);

      try {
        const payload = buildClaimRewardPayload({
          level,
          sessionId,
          solutionMerkle: merkle,
          timeMs: elapsedSec * 1000,
          hintsUsed,
        });
        const pending = await signAndSubmitTransaction(payload);
        const aptos = getAptosClient();
        await aptos.waitForTransaction({ transactionHash: pending.hash });
        claimedOnChain = true;
        toast.success(`Claimed ${reward} shelbyUSD`);
        window.dispatchEvent(new CustomEvent("shelby:balances"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("PUZZLE_REGISTRY_ADDRESS")) {
          toast.message("Reward marked locally (deploy Move package for on-chain claim)");
        } else {
          throw err;
        }
      }

      await markLevelComplete(account.address.toString(), level);
      recordSolveStreak();
      recordLocalLeaderboardEntry({
        addr: account.address.toString(),
        level: replayLevel,
        time_ms: elapsedSec * 1000,
        hints_used: hintsUsed,
      });

      const blob = await uploadReplay();
      setClaimed(true);
      onClaimed?.(blob);

      if (!claimedOnChain) {
        toast.success(
          isDaily
            ? "Daily challenge complete"
            : `Level ${level} complete — next unlocked`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setLoading(false);
    }
  };

  const replayHref =
    (replayId || lookupReplayBlobName(replayLevel, addr)) && addr
      ? `/replay/${isDaily ? "daily" : level}/${encodeURIComponent(addr)}`
      : null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.reward.title}
      description={
        isDaily
          ? `Daily challenge · ${meta.difficulty}`
          : `Level ${level} · ${meta.difficulty}`
      }
    >
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-shelby-gold/15">
          <Trophy className="h-8 w-8 text-shelby-gold" />
        </div>
        <p className="text-sm text-shelby-muted">
          {claimed ? t.reward.claimed : t.reward.available}
          {isDaily ? " · 2× daily bonus" : ""}
        </p>
        <p className="text-3xl font-bold text-shelby-gold">
          +{reward}{" "}
          <span className="text-base font-medium text-shelby-muted">shelbyUSD</span>
        </p>
        <div className="flex w-full flex-col gap-2">
          <Button
            className="w-full"
            onClick={() => void claim()}
            disabled={loading || claimed}
            aria-label="Claim reward"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {claimed ? t.reward.claimed.split("—")[0]?.trim() || "Claimed" : t.reward.claim}
          </Button>
          {replayHref ? (
            <Link href={replayHref} className="w-full">
              <Button className="w-full" variant="secondary" aria-label="Watch replay">
                <Play className="h-4 w-4" />
                {t.reward.watchReplay}
              </Button>
            </Link>
          ) : null}
          {!isDaily ? (
            <Link href={`/play/${nextLevel}`} className="w-full">
              <Button
                className="w-full"
                variant={claimed ? "primary" : "secondary"}
                aria-label={`Next level, go to level ${nextLevel}`}
              >
                {t.play.nextLevel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Link href="/" className="w-full">
              <Button className="w-full" variant={claimed ? "primary" : "secondary"}>
                {t.play.backToMap}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </Dialog>
  );
}
