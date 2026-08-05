"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { toast } from "sonner";
import { Delete, Pencil, Redo2, Undo2 } from "lucide-react";
import { SudokuBoard, type SudokuBoardHandle } from "./sudoku-board";
import { Button } from "@/components/ui/button";
import { RewardModal } from "./RewardModal";
import { cn } from "@/lib/utils";
import { fetchPuzzle, generateFallbackPuzzle, type FetchedPuzzle } from "@/lib/fetcher";
import { recordRead } from "./ReadLedger";
import { findEmpty, isSolved as checkSolved } from "@/lib/sudoku";
import { registryAddress, waitForTxSuccess } from "@/lib/aptos";
import { explorerTxUrl } from "@/lib/utils";
import {
  economicsForLevel,
  HINT_COST_LABEL,
  HINT_COST_PASS_LABEL,
  MAX_HINTS_PER_LEVEL,
  MAX_LEVEL,
} from "@/lib/tokenomics";
import { markDailyComplete } from "@/lib/daily";
import {
  bumpLocalHintsUsed,
  fetchOnChainHintsUsed,
  getLocalHintsUsed,
  hintLimitReached,
} from "@/lib/hints";
import { markCleared } from "@/lib/progress";
import { recordRun } from "@/lib/leaderboard";
import { bumpStreak } from "@/lib/streak";
import { isSeasonPassActive, seasonBoardClass, fetchOnChainSeasonPassActive, clearSeasonPassLocal } from "@/lib/season-pass";
import { buildBuyHintPayload } from "@/lib/contracts";
import { explainTxError } from "@/lib/tx-errors";

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
  // Level 0 is the daily-challenge sentinel (see app/play/daily). Campaign is 1–20.
  const parsed = Number(raw);
  const level =
    levelProp === 0 || raw === "0"
      ? 0
      : Number.isFinite(parsed) && parsed >= 0
        ? Math.min(MAX_LEVEL, Math.floor(parsed)) || 1
        : 1;
  const isDaily = level === 0;
  const registry = registryAddress();

  const [puzzle, setPuzzle] = useState<FetchedPuzzle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hintCount, setHintCount] = useState(0);
  /** When registry is set, paid hints require a successful on-chain counter read. */
  const [hintChainOk, setHintChainOk] = useState(false);
  const [buying, setBuying] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [solvedBoard, setSolvedBoard] = useState<number[] | null>(null);
  const [solveMs, setSolveMs] = useState<number | null>(null);
  const [isSolved, setIsSolved] = useState(false);
  const [notesMode, setNotesMode] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const [seasonActive, setSeasonActive] = useState(false);
  /** Only true when on-chain `has_active_pass` confirms — drives discounted buy_hint. */
  const [seasonDiscount, setSeasonDiscount] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const boardRef = useRef<SudokuBoardHandle | null>(null);
  const rewardFired = useRef(false);
  const puzzleRef = useRef<FetchedPuzzle | null>(null);
  puzzleRef.current = puzzle;

  useEffect(() => {
    const refreshLocal = () => setSeasonActive(isSeasonPassActive());
    refreshLocal();
    window.addEventListener("shelby:season-pass", refreshLocal);
    return () => window.removeEventListener("shelby:season-pass", refreshLocal);
  }, []);

  // Prefer chain truth for the discounted hint path. LocalStorage alone caused
  // E_PASS_INACTIVE when a stale/local pass routed to season_pass::buy_hint.
  useEffect(() => {
    let cancelled = false;
    const addr = account?.address;
    if (!addr || !registry) {
      setSeasonDiscount(false);
      return;
    }
    void fetchOnChainSeasonPassActive(addr).then((active) => {
      if (cancelled) return;
      if (active === true) {
        setSeasonDiscount(true);
        setSeasonActive(true);
        return;
      }
      setSeasonDiscount(false);
      // Stale local-only / expired on-chain pass must not keep routing to buy_hint.
      if (active === false && isSeasonPassActive()) clearSeasonPassLocal();
    });
    return () => {
      cancelled = true;
    };
  }, [account?.address, registry]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setRewardOpen(false);
    setIsSolved(false);
    setNotesMode(false);
    setHistoryTick(0);
    setSolvedBoard(null);
    setSolveMs(null);
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
    // The solved grid is what the claim-ticket endpoint verifies.
    setSolvedBoard(boardRef.current?.getBoard() ?? null);
    setSolveMs(Date.now() - startedAt.current);
    setRewardOpen(true);
    if (account?.address) {
      // Campaign progress is HMAC-local; daily does not unlock campaign levels.
      if (!isDaily) {
        markCleared(account.address, level).catch(() => undefined);
        recordRun(account.address, level, Date.now() - startedAt.current);
      } else {
        markDailyComplete();
      }
      bumpStreak();
      window.dispatchEvent(new CustomEvent("shelby:balances"));
    }
  }, [account?.address, level, isDaily]);

  const refreshHints = useCallback(async () => {
    const addr = account?.address;
    if (!addr) {
      setHintCount(0);
      setHintChainOk(false);
      return;
    }
    if (registry) {
      const onChain = await fetchOnChainHintsUsed(registry, addr, level);
      if (onChain !== null) {
        setHintCount(onChain);
        setHintChainOk(true);
        return;
      }
      // Fail closed: do not trust forgeable localStorage for paid hints.
      setHintChainOk(false);
      return;
    }
    setHintCount(getLocalHintsUsed(addr, level));
    setHintChainOk(false);
  }, [account?.address, registry, level]);

  useEffect(() => {
    void refreshHints();
  }, [refreshHints]);

  const bumpHistory = useCallback(() => {
    setHistoryTick((n) => n + 1);
  }, []);

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
      bumpHistory();
      return;
    }

    if (!hintChainOk) {
      toast.error("Cannot verify hint balance on-chain", {
        description: "Retry when the Aptos RPC is reachable.",
      });
      await refreshHints();
      return;
    }

    setBuying(true);
    setError(null);
    try {
      // Re-check chain right before signing — localStorage alone caused E_PASS_INACTIVE.
      const onChainPass = await fetchOnChainSeasonPassActive(addr);
      const usePass = onChainPass === true;
      setSeasonDiscount(usePass);
      if (usePass) setSeasonActive(true);
      else if (onChainPass === false && isSeasonPassActive()) clearSeasonPassLocal();

      const pending = await signAndSubmitTransaction(
        buildBuyHintPayload({ level, seasonPass: usePass }),
      );
      await waitForTxSuccess(pending.hash);
      // Only reveal after the transfer commits, so a rejected or aborted
      // transaction never yields a free hint.
      boardRef.current?.fillHint(emptyIdx, puzzle.solution[emptyIdx]);
      bumpHistory();
      window.dispatchEvent(new CustomEvent("shelby:balances"));
      await refreshHints();
      toast.success(usePass ? "Hint purchased (Season Pass)" : "Hint purchased", {
        description: "View transaction on explorer",
        action: {
          label: "Explorer",
          onClick: () => window.open(explorerTxUrl(pending.hash), "_blank"),
        },
      });
    } catch (e) {
      const friendly = explainTxError(e, "hint");
      setError(`${friendly.title} — ${friendly.detail}`);
      toast.error(friendly.title, { description: friendly.detail });
      console.warn("[hint]", friendly.raw);
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
    bumpHistory,
    hintChainOk,
  ]);

  const handleDigit = (d: number) => {
    boardRef.current?.setDigit(d);
    bumpHistory();
  };

  const handleClear = () => {
    boardRef.current?.clear();
    bumpHistory();
  };

  const handleUndo = () => {
    boardRef.current?.undo();
    bumpHistory();
  };

  const handleRedo = () => {
    boardRef.current?.redo();
    bumpHistory();
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
  // historyTick forces re-read of canUndo/canRedo after board mutations.
  void historyTick;
  const canUndo = boardRef.current?.canUndo() ?? false;
  const canRedo = boardRef.current?.canRedo() ?? false;
  const hintLabel = seasonDiscount ? HINT_COST_PASS_LABEL : HINT_COST_LABEL;
  const boardSkin = seasonDiscount || seasonActive ? seasonBoardClass() : "";

  return (
    <main className="relative mx-auto flex max-w-[720px] flex-col px-6 pb-20 pt-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-64 max-w-lg bg-accent/[0.07] blur-3xl"
      />

      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-content">
            {isDaily ? "Daily challenge" : `Level ${pad2(level)}`}
          </h1>
          <p className="text-xs uppercase tracking-[0.14em] text-content-muted">
            {econ.difficulty}
            <span className="text-content-subtle"> · {econ.empties} empty</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 rounded-md border border-line bg-surface/70 px-3 py-2 backdrop-blur-sm">
          <span className="font-mono text-lg tabular-nums text-content">{fmt(elapsedMs)}</span>
          <span className="font-mono text-[11px] text-content-muted">
            {hintCount}/{MAX_HINTS_PER_LEVEL} hints
          </span>
          {seasonDiscount ? (
            <span className="text-[10px] font-medium uppercase tracking-wide text-accent-hover">
              Season Pass
            </span>
          ) : null}
        </div>
      </header>

      <div className="my-8 h-px bg-gradient-to-r from-transparent via-line to-transparent" />

      {error && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {puzzle ? (
        <>
          <div className="flex justify-center">
            <div
              className={cn(
                "rounded-xl border border-line-strong/80 bg-surface p-3 sm:p-4",
                boardSkin,
              )}
              style={
                boardSkin
                  ? undefined
                  : {
                      boxShadow:
                        "0 0 0 1px rgba(139,92,246,0.08), 0 24px 48px -24px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.03)",
                    }
              }
            >
              <SudokuBoard
                ref={boardRef}
                puzzle={puzzle.puzzle}
                onSolve={onSolve}
                notesMode={notesMode}
                onChange={bumpHistory}
              />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex flex-wrap justify-center gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-label={notesMode ? `Toggle note ${d}` : `Enter ${d}`}
                  onClick={() => handleDigit(d)}
                  className={cn(
                    "h-10 w-11 rounded-md border font-mono text-base transition-colors duration-150",
                    notesMode
                      ? "border-accent/40 bg-accent/10 text-accent-hover hover:border-accent"
                      : "border-line bg-surface-2 text-content hover:border-line-strong",
                  )}
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                aria-label="Erase cell"
                onClick={handleClear}
                className="flex h-10 w-11 items-center justify-center rounded-md border border-line bg-surface-2 text-content-muted transition-colors duration-150 hover:border-line-strong hover:text-content"
              >
                <Delete className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="flex gap-1.5 rounded-md border border-line bg-surface/80 p-1">
                <button
                  type="button"
                  aria-label="Undo"
                  aria-keyshortcuts="Control+Z"
                  disabled={!canUndo}
                  onClick={handleUndo}
                  className="flex h-8 w-9 items-center justify-center rounded-sm text-content-muted transition-colors duration-150 hover:bg-surface-2 hover:text-content disabled:opacity-35"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Redo"
                  aria-keyshortcuts="Control+Y"
                  disabled={!canRedo}
                  onClick={handleRedo}
                  className="flex h-8 w-9 items-center justify-center rounded-sm text-content-muted transition-colors duration-150 hover:bg-surface-2 hover:text-content disabled:opacity-35"
                >
                  <Redo2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Toggle notes"
                  aria-pressed={notesMode}
                  onClick={() => setNotesMode((v) => !v)}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors duration-150",
                    notesMode
                      ? "bg-accent/15 text-accent-hover"
                      : "text-content-muted hover:bg-surface-2 hover:text-content",
                  )}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Notes
                </button>
              </div>

              <Button
                variant="primary"
                onClick={buyHint}
                disabled={buying || atHintLimit || (Boolean(registry) && !hintChainOk)}
              >
                {buying
                  ? "Confirming"
                  : atHintLimit
                    ? `Hints ${MAX_HINTS_PER_LEVEL}/${MAX_HINTS_PER_LEVEL}`
                    : registry && !hintChainOk
                      ? "Hint unavailable"
                      : registry
                        ? `Hint · ${hintLabel}${seasonDiscount ? " · pass" : ""}`
                        : "Free hint"}
              </Button>
            </div>

            <p className="text-center font-mono text-[11px] text-content-subtle">
              source: {puzzle.source} · chain: {registry ? "on" : "off"}
            </p>
          </div>

          {isSolved && (
            <div className="mt-8 flex items-center gap-3 border-t border-line pt-6">
              <Button variant="secondary" onClick={() => router.push("/")}>
                Back to levels
              </Button>
              {!isDaily && level < MAX_LEVEL && (
                <Button variant="primary" onClick={handleNext}>
                  Next level
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="animate-pulse text-sm text-content-muted">Loading puzzle…</p>
      )}
      {puzzle && (
        <RewardModal
          open={rewardOpen}
          onClose={() => {
            setRewardOpen(false);
          }}
          level={level}
          ms={solveMs ?? elapsedMs}
          hints={hintCount}
          board={solvedBoard}
        />
      )}
    </main>
  );
}