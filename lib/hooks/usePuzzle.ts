"use client";

import { useEffect, useState } from "react";
import { decodePuzzleBlob, type PuzzleBlob } from "@/lib/codec";
import {
  difficultyForLevel,
  economicsForLevel,
  HINT_COST_SUSD,
  REWARD_PER_LEVEL_SUSD,
} from "@/lib/tokenomics";
import {
  fnv1a,
  generateFullSolution,
  type Board,
  type Difficulty,
} from "@/lib/sudoku";
import { fetchBlobBytes, recordRead } from "@/lib/shelby";
import { dailyBlobName, todayKey } from "@/lib/utils";

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
  const econ = economicsForLevel(level);
  const seed = fnv1a(`sudoku:level:${level}:${todayKey()}`);
  const solution = generateFullSolution(seed);
  const puzzle = solution.slice();
  const empties = econ.empties;
  let removed = 0;
  let i = 0;
  while (removed < empties && i < 81) {
    const j = Math.floor(((seed + i) % 1000) / 1000 * 81);
    if (puzzle[j] !== 0) {
      puzzle[j] = 0;
      removed++;
    }
    i++;
  }
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

async function tryShelby(level: number): Promise<Uint8Array | null> {
  if (typeof window === "undefined") return null;
  try {
    const account = process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS?.trim() || "sudoku-curator";
    const blobName = dailyBlobName(level, todayKey());
    return await fetchBlobBytes({ account, blobName });
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
      const cached = cacheGet(level);
      if (cached) {
        if (cancelled) return;
        recordRead(level, "cache");
        setState({ blob: cached, source: "cache", error: null, loading: false });
        return;
      }

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
