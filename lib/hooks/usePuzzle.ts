"use client";

import { useEffect, useState } from "react";
import { decodePuzzleBlob, type PuzzleBlob } from "@/lib/codec";
import {
  difficultyForLevel,
  economicsForLevel,
  HINT_COST_SUSD,
  REWARD_PER_LEVEL_SUSD,
} from "@/lib/tokenomics";
import { fnv1a, generatePuzzle, type Board, type Difficulty } from "@/lib/sudoku";
import { fetchBlobBytes, recordRead } from "@/lib/shelby";
import { dailyBlobName, todayKey, withTimeout } from "@/lib/utils";
import { SHELBY_TIMEOUT_MS } from "@/lib/fetcher";

export type PuzzleSource = "shelby" | "cache" | "generated";

export interface FetchedPuzzle {
  puzzle: Board;
  solution: Board;
  empties: number;
  source: PuzzleSource;
}

export interface UsePuzzleState {
  blob: PuzzleBlob | null;
  source: PuzzleSource | null;
  error: string | null;
  loading: boolean;
}

const CACHE_PREFIX = "shelby-sudoku-cache";

function cacheKey(level: number): string {
  return `${CACHE_PREFIX}:${level}:${todayKey()}`;
}

function cacheGet(level: number): PuzzleBlob | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(cacheKey(level));
  if (!raw) return null;
  try {
    const buf = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    return decodePuzzleBlob(buf);
  } catch {
    return null;
  }
}

function cachePut(level: number, bytes: Uint8Array): void {
  if (typeof window === "undefined") return;
  try {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    window.localStorage.setItem(cacheKey(level), btoa(bin));
  } catch {
    /* quota */
  }
}

function generateBlob(level: number): PuzzleBlob {
  const seed = fnv1a(`sudoku:level:${level}:${todayKey()}`);
  const { puzzle, solution } = generatePuzzle(level, seed);
  return {
    level,
    difficulty: difficultyForLevel(level),
    hintCost: HINT_COST_SUSD,
    reward: REWARD_PER_LEVEL_SUSD,
    puzzle,
    solution,
    ts: Date.now(),
  };
}

/** Tier 1. The only tier that needs an account; resolves null on any failure. */
async function tryShelby(level: number): Promise<Uint8Array | null> {
  if (typeof window === "undefined") return null;
  const account =
    process.env.NEXT_PUBLIC_CURATOR_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS?.trim() ||
    "";
  if (!account) {
    console.warn("[shelby:fallback]", "no curator account configured");
    return null;
  }
  const blobName = dailyBlobName(level, todayKey());
  try {
    return await withTimeout(
      fetchBlobBytes({ account, blobName }),
      SHELBY_TIMEOUT_MS,
      `shelby download ${blobName}`,
    );
  } catch (err) {
    console.warn("[shelby:fallback]", err);
    return null;
  }
}

export function usePuzzle(level: number): UsePuzzleState {
  const [state, setState] = useState<UsePuzzleState>({
    blob: null,
    source: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ blob: null, source: null, error: null, loading: true });

    (async () => {
      // 1) Shelby, before the cache so a generated puzzle can never shadow a
      //    real blob. Time-capped inside tryShelby.
      const shelbyBytes = await tryShelby(level);
      if (shelbyBytes) {
        try {
          const blob = decodePuzzleBlob(shelbyBytes);
          cachePut(level, shelbyBytes);
          if (cancelled) return;
          recordRead(level, "shelby");
          setState({ blob, source: "shelby", error: null, loading: false });
          return;
        } catch (err) {
          console.warn("[shelby:fallback]", err);
        }
      }

      // 2) localStorage cache — runs regardless of wallet state.
      const cached = cacheGet(level);
      if (cached) {
        if (cancelled) return;
        recordRead(level, "cache");
        setState({ blob: cached, source: "cache", error: null, loading: false });
        return;
      }

      // 3) Deterministic generator — cannot fail.
      const blob = generateBlob(level);
      if (cancelled) return;
      recordRead(level, "generated");
      setState({ blob, source: "generated", error: null, loading: false });
    })().catch((err: unknown) => {
      if (cancelled) return;
      setState({ blob: null, source: null, error: String(err), loading: false });
    });

    return () => {
      cancelled = true;
    };
  }, [level]);

  return state;
}

export function __diff(_level: number, _d: Difficulty): string {
  return "";
}
