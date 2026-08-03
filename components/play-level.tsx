"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { SudokuBoard, type SudokuBoardHandle } from "./sudoku-board";
import { Button } from "@/components/ui/button";
import { RewardModal } from "./RewardModal";
import { fetchPuzzle, type FetchedPuzzle } from "@/lib/fetcher";
import { recordRead } from "./ReadLedger";
import { findEmpty, isSolved as checkSolved } from "@/lib/sudoku";
import { loadPrefs, effectiveHintCost } from "@/lib/preferences";
import { economicsForLevel, DAILY_BONUS_MULT } from "@/lib/tokenomics";
import { markCleared } from "@/lib/progress";
import { recordRun } from "@/lib/leaderboard";
import { bumpStreak } from "@/lib/streak";
import { MAX_LEVEL } from "@/lib/tokenomics";

function fmt(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export interface PlayLevelPageProps {
  level?: number;
}

export function PlayLevelPage({ level: levelProp }: PlayLevelPageProps = {}) {
  const params = useParams<{ level?: string; n?: string }>();
  const router = useRouter();
  const { account } = useWallet();
  const raw = levelProp !== undefined ? String(levelProp) : (params?.level ?? params?.n ?? "1");
  const level = Math.max(1, Number(raw) || 1);

  const [puzzle, setPuzzle] = useState<FetchedPuzzle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isSolved, setIsSolved] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const boardRef = useRef<SudokuBoardHandle | null>(null);
  const rewardFired = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setRewardOpen(false);
    setIsSolved(false);
    rewardFired.current = false;
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
    if (rewardFired.current) return;
    rewardFired.current = true;
    setIsSolved(true);
    setRewardOpen(true);
    if (account?.address) {
      // Reward is settled on-chain via the registered Move package (or the
      // off-chain HMAC shim when registry is unset). Just bump UI signals.
      markCleared(account.address, level).catch(() => undefined);
      recordRun(account.address, level, Date.now() - startedAt.current);
      bumpStreak();
      window.dispatchEvent(new CustomEvent("shelby:balances"));
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
    // Hint cost is settled on-chain via hint_shop::buy_hint; the actual
    // payment is debited by the Move package once `NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS`
    // is configured. Until then the UI lets you tap a local hint and we just
    // ask the wallet hook to refresh from chain.
    window.dispatchEvent(new CustomEvent("shelby:balances"));
    const emptyIdx = findEmpty(boardRef.current?.getBoard() ?? []);
    if (emptyIdx < 0) return;
    boardRef.current?.fillHint(emptyIdx, puzzle.solution[emptyIdx]);
    setHintCount((n) => n + 1);
  };

  const handleDigit = (d: number) => {
    boardRef.current?.setDigit(d);
  };

  const handleClear = () => {
    boardRef.current?.clear();
  };

  const handleNext = () => {
    if (!isSolved) return;
    const next = level + 1;
    if (next <= MAX_LEVEL) {
      router.push(`/level/${next}`);
    } else {
      router.push("/");
    }
  };

  const locked = useMemo(
    () => puzzle && puzzle.source !== "shelby",
    [puzzle],
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Level {level}</h1>
        <div className="flex items-center gap-3">
          {isSolved && level < MAX_LEVEL && (
            <Button
              variant="ghost"
              onClick={handleNext}
              className="text-sm text-shelby-accent2 hover:text-shelby-accent2"
            >
              Next →
            </Button>
          )}
          {isSolved && level === MAX_LEVEL && (
            <Button variant="ghost" onClick={() => router.push("/")} className="text-sm">
              All levels cleared ✓
            </Button>
          )}
          <Button variant="ghost" onClick={() => router.push("/")}>Back</Button>
        </div>
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
            <Button variant="ghost" onClick={handleClear}>Clear</Button>
            {locked && (
              <span className="text-xs text-shelby-muted">
                Source: {puzzle.source}
              </span>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDigit(d)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-shelby-border bg-shelby-surface text-lg font-semibold text-shelby-fg-strong hover:bg-shelby-bg"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-shelby-border bg-shelby-surface text-lg font-semibold text-shelby-danger hover:bg-shelby-bg"
            >
              ⌫
            </button>
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
          }}
          level={level}
          ms={elapsedMs}
          hints={hintCount}
        />
      )}
    </main>
  );
}