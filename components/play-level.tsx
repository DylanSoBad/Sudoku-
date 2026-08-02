"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { SudokuBoard, type SudokuBoardHandle } from "./sudoku-board";
import { Button } from "@/components/ui/button";
import { RewardModal } from "./RewardModal";
import { fetchPuzzle, type FetchedPuzzle } from "@/lib/fetcher";
import { recordRead } from "./ReadLedger";
import { findEmpty, isSolved } from "@/lib/sudoku";
import { creditShelbyUSD, debitShelbyUSD } from "@/lib/balances";
import { loadPrefs, effectiveHintCost } from "@/lib/preferences";
import { economicsForLevel, DAILY_BONUS_MULT } from "@/lib/tokenomics";
import { markCleared } from "@/lib/progress";
import { recordRun } from "@/lib/leaderboard";
import { bumpStreak } from "@/lib/streak";

function fmt(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PlayLevelPage() {
  const params = useParams<{ level?: string; n?: string }>();
  const router = useRouter();
  const { account } = useWallet();
  const raw = params?.level ?? params?.n ?? "1";
  const level = Math.max(1, Number(raw) || 1);

  const [puzzle, setPuzzle] = useState<FetchedPuzzle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef<number>(Date.now());
  const boardRef = useRef<SudokuBoardHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchPuzzle(level)
      .then((p) => {
        if (cancelled) return;
        setPuzzle(p);
        startedAt.current = Date.now();
        recordRead(level, p.source);
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [level]);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startedAt.current);
    }, 250);
    return () => clearInterval(id);
  }, [puzzle?.ts]);

  const onSolve = useCallback(() => {
    setRewardOpen(true);
    if (account?.address) {
      const econ = economicsForLevel(level);
      const reward = econ.reward * (level === 0 ? DAILY_BONUS_MULT : 1);
      creditShelbyUSD(account.address, reward);
      markCleared(account.address, level).catch(() => undefined);
      recordRun(account.address, level, Date.now() - startedAt.current);
      bumpStreak();
    }
  }, [account?.address, level]);

  const buyHint = () => {
    if (!puzzle) return;
    const econ = economicsForLevel(level);
    const prefs = loadPrefs();
    const cost = effectiveHintCost(econ.hintCost, prefs);
    if (!account?.address) {
      setError("Connect wallet to buy hints");
      return;
    }
    debitShelbyUSD(account.address, cost);
    const emptyIdx = findEmpty(boardRef.current?.getBoard() ?? []);
    if (emptyIdx < 0) return;
    boardRef.current?.fillHint(emptyIdx, puzzle.solution[emptyIdx]);
    setHintCount((n) => n + 1);
  };

  const locked = useMemo(
    () => puzzle && puzzle.source !== "shelby",
    [puzzle],
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Level {level}</h1>
        <Button variant="ghost" onClick={() => router.push("/")}>Back</Button>
      </header>
      {error && (
        <div className="rounded-lg border border-shelby-danger/30 bg-shelby-danger/10 px-3 py-2 text-sm text-shelby-danger">
          {error}
        </div>
      )}
      {puzzle ? (
        <>
          <div className="flex items-center justify-between text-sm text-shelby-muted">
            <span>
              {(() => {
                const econ = economicsForLevel(level);
                if (!econ || typeof econ.empties !== "number") {
                  if (process.env.NODE_ENV !== "production") {
                    throw new Error(
                      `tokenomics: missing empties for level ${level}`,
                    );
                  }
                  return `${puzzle.difficulty.toUpperCase()} · empty`;
                }
                return `${econ.difficulty.toUpperCase()} · ${econ.empties} empty`;
              })()}
            </span>
            <span>{fmt(elapsedMs)}</span>
            <span>{hintCount} hint{hintCount === 1 ? "" : "s"}</span>
          </div>
          <SudokuBoard
            ref={boardRef}
            puzzle={puzzle.puzzle}
            onSolve={onSolve}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={buyHint}>
              Buy hint ({economicsForLevel(level).hintCost.toFixed(2)} sUSD)
            </Button>
            <Button variant="ghost" onClick={() => boardRef.current?.clear()}>Clear</Button>
            {locked && (
              <span className="text-xs text-shelby-muted">
                Source: {puzzle.source}
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-shelby-muted">Loading puzzle…</p>
      )}
      {puzzle && (
        <RewardModal
          open={rewardOpen}
          onClose={() => {
            setRewardOpen(false);
            router.push("/");
          }}
          level={level}
          ms={elapsedMs}
          hints={hintCount}
        />
      )}
    </main>
  );
}