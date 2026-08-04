"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { toast } from "sonner";
import { Delete } from "lucide-react";
import { SudokuBoard, type SudokuBoardHandle } from "./sudoku-board";
import { Button } from "@/components/ui/button";
import { RewardModal } from "./RewardModal";
import { fetchPuzzle, generateFallbackPuzzle, type FetchedPuzzle } from "@/lib/fetcher";
import { recordRead } from "./ReadLedger";
import { findEmpty, isSolved as checkSolved } from "@/lib/sudoku";
import { registryAddress, waitForTxSuccess } from "@/lib/aptos";
import { explorerTxUrl } from "@/lib/utils";
import {
  economicsForLevel,
  DAILY_BONUS_MULT,
  HINT_COST_LABEL,
  MAX_HINTS_PER_LEVEL,
  MAX_LEVEL,
} from "@/lib/tokenomics";
import {
  bumpLocalHintsUsed,
  fetchOnChainHintsUsed,
  getLocalHintsUsed,
  hintLimitReached,
} from "@/lib/hints";
import { markCleared } from "@/lib/progress";
import { recordRun } from "@/lib/leaderboard";
import { bumpStreak } from "@/lib/streak";

function fmt(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Longer than the 4s Shelby cap so the cascade always gets to finish first. */
const WATCHDOG_MS = 6_000;

export interface PlayLevelPageProps {
  level?: number;
}

export function PlayLevelPage({ level: levelProp }: PlayLevelPageProps = {}) {
  const params = useParams<{ level?: string; n?: string }>();
  const router = useRouter();
  const { account, signAndSubmitTransaction } = useWallet();
  const raw = levelProp !== undefined ? String(levelProp) : (params?.level ?? params?.n ?? "1");
  const level = Math.max(1, Number(raw) || 1);
  const registry = registryAddress();

  const [puzzle, setPuzzle] = useState<FetchedPuzzle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [buying, setBuying] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isSolved, setIsSolved] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const boardRef = useRef<SudokuBoardHandle | null>(null);
  const rewardFired = useRef(false);
  const puzzleRef = useRef<FetchedPuzzle | null>(null);
  puzzleRef.current = puzzle;

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

  // Last-resort watchdog. fetchPuzzle is written to always resolve, so this
  // should never fire; if it does, something upstream is pending forever and a
  // playable board still beats an indefinite "Loading puzzle".
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (puzzleRef.current) return;
      console.warn(
        `[puzzle:watchdog] level ${level} produced no puzzle within ${WATCHDOG_MS}ms, forcing generated output`,
      );
      const fb = generateFallbackPuzzle(level);
      setPuzzle(fb);
      startedAt.current = Date.now();
      recordRead(level, fb.source);
    }, WATCHDOG_MS);
    return () => window.clearTimeout(id);
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

  const refreshHints = useCallback(async () => {
    const addr = account?.address;
    if (!addr) {
      setHintCount(0);
      return;
    }
    if (registry) {
      const onChain = await fetchOnChainHintsUsed(registry, addr, level);
      if (onChain !== null) {
        setHintCount(onChain);
        return;
      }
    }
    setHintCount(getLocalHintsUsed(addr, level));
  }, [account?.address, registry, level]);

  useEffect(() => {
    void refreshHints();
  }, [refreshHints]);

  const buyHint = useCallback(async () => {
    if (!puzzle || buying) return;
    const addr = account?.address;
    if (!addr) {
      setError("Connect wallet to buy hints");
      return;
    }
    if (hintLimitReached(hintCount)) {
      toast.error(`Max ${MAX_HINTS_PER_LEVEL} hints per level`);
      return;
    }
    const emptyIdx = findEmpty(boardRef.current?.getBoard() ?? []);
    if (emptyIdx < 0) return;

    // Without a published package there is nothing to charge, so fall back to
    // a local hint while still honouring the same per-level cap.
    if (!registry) {
      boardRef.current?.fillHint(emptyIdx, puzzle.solution[emptyIdx]);
      setHintCount(bumpLocalHintsUsed(addr, level));
      return;
    }

    setBuying(true);
    setError(null);
    try {
      const pending = await signAndSubmitTransaction({
        data: {
          function: `${registry}::hint_shop::buy_hint`,
          typeArguments: [],
          functionArguments: [level],
        },
      });
      await waitForTxSuccess(pending.hash);
      // Only reveal after the transfer commits, so a rejected or aborted
      // transaction never yields a free hint.
      boardRef.current?.fillHint(emptyIdx, puzzle.solution[emptyIdx]);
      window.dispatchEvent(new CustomEvent("shelby:balances"));
      await refreshHints();
      toast.success("Hint purchased", {
        description: "View transaction on explorer",
        action: {
          label: "Explorer",
          onClick: () => window.open(explorerTxUrl(pending.hash), "_blank"),
        },
      });
    } catch (e) {
      const msg = (e as Error).message ?? "Hint purchase failed";
      setError(msg);
      toast.error("Hint purchase failed", { description: msg });
    } finally {
      setBuying(false);
    }
  }, [
    puzzle,
    buying,
    account?.address,
    hintCount,
    level,
    registry,
    refreshHints,
    signAndSubmitTransaction,
  ]);

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
      router.push(`/play/${next}`);
    } else {
      router.push("/");
    }
  };

  const econ = useMemo(() => {
    const row = economicsForLevel(level);
    if (!row || typeof row.empties !== "number") {
      if (process.env.NODE_ENV !== "production") {
        throw new Error(`tokenomics: missing empties for level ${level}`);
      }
      return { difficulty: "easy", empties: 0 } as const;
    }
    return row;
  }, [level]);

  const atHintLimit = hintLimitReached(hintCount);

  return (
    <main className="mx-auto flex max-w-[720px] flex-col px-6 pb-16 pt-8">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-content">
            Level {pad2(level)}
          </h1>
          <p className="text-xs uppercase tracking-wide text-content-muted">
            {econ.difficulty} - {econ.empties} empty
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="font-mono text-lg tabular-nums text-content">{fmt(elapsedMs)}</span>
          <span className="font-mono text-sm text-content-muted">
            {hintCount} / {MAX_HINTS_PER_LEVEL} hints
          </span>
        </div>
      </header>

      <div className="my-6 h-px bg-line" />

      {error && (
        <div className="mb-4 rounded-md border border-line bg-surface px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {puzzle ? (
        <>
          <div className="flex justify-center">
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <SudokuBoard ref={boardRef} puzzle={puzzle.puzzle} onSolve={onSolve} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button
                key={d}
                type="button"
                aria-label={`Enter ${d}`}
                onClick={() => handleDigit(d)}
                className="h-10 w-11 rounded-md border border-line bg-surface-2 font-mono text-base text-content transition-colors duration-100 hover:border-line-strong"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              aria-label="Erase cell"
              onClick={handleClear}
              className="flex h-10 w-11 items-center justify-center rounded-md border border-line bg-surface-2 text-content-muted transition-colors duration-100 hover:border-line-strong hover:text-content"
            >
              <Delete className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="ghost" onClick={handleClear}>
              Clear board
            </Button>
            <Button variant="primary" onClick={buyHint} disabled={buying || atHintLimit}>
              {buying
                ? "Confirming"
                : atHintLimit
                  ? `Hint limit reached - ${MAX_HINTS_PER_LEVEL}/${MAX_HINTS_PER_LEVEL}`
                  : registry
                    ? `Buy hint - ${HINT_COST_LABEL}`
                    : "Free hint - offline"}
            </Button>
            <span className="ml-auto font-mono text-[11px] text-content-subtle">
              source: {puzzle.source} | chain: {registry ? "on" : "off"}
            </span>
          </div>

          {isSolved && (
            <div className="mt-6 flex items-center gap-3 border-t border-line pt-6">
              <Button variant="secondary" onClick={() => router.push("/")}>
                Back to levels
              </Button>
              {level < MAX_LEVEL && (
                <Button variant="primary" onClick={handleNext}>
                  Next level
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-content-muted">Loading puzzle</p>
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