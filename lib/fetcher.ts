/**
 * fetchPuzzle: load puzzle data for a level with three-tier fallback.
 *
 * 1) Try Shelby download (`@shelby-protocol/sdk/browser`).
 * 2) localStorage cache (so reopening a level is instant + counts as a read).
 * 3) Deterministic generator (logged as `[shelby:fallback]`).
 */
import { decodePuzzleBlob, encodePuzzleBlob, type PuzzleBlob } from "./blob-layout";
import { difficultyForLevel, economicsForLevel } from "./tokenomics";
import { fnv1a, generatePuzzle } from "./sudoku";

const CACHE_PREFIX = "shelby-sudoku-cache:";

export interface FetchedPuzzle extends PuzzleBlob {
  source: "shelby" | "cache" | "generated";
  empties?: number;
}

function cacheKey(level: number, date: string): string {
  return `${CACHE_PREFIX}${level}:${date}`;
}

function dailyBlobName(level: number, date: string): string {
  if (level === 0) return `shelby-sudoku-daily-${date}`;
  return `shelby-sudoku-level-${level}`;
}

function todayUTC(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Account that owns the puzzle blobs on Shelby. The curator uploads under its
 * own wallet address, which in the documented deployment is the same account
 * that published the Move package.
 */
function curatorAccount(): string {
  return (
    process.env.NEXT_PUBLIC_CURATOR_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS?.trim() ||
    ""
  );
}

function fallback(level: number): FetchedPuzzle {
  const econ = economicsForLevel(level);
  const diff = difficultyForLevel(level);
  const { puzzle, solution } = generatePuzzle(level, fnv1a(level + "-" + todayUTC()));
  return {
    level,
    difficulty: diff,
    hintCost: econ.hintCost,
    reward: econ.reward,
    puzzle,
    solution,
    ts: Date.now(),
    source: "generated",
  };
}

export async function fetchPuzzle(level: number): Promise<FetchedPuzzle> {
  const date = todayUTC();
  const blobName = dailyBlobName(level, date);

  // 1) Shelby. Attempted before the cache so a locally generated puzzle can
  //    never permanently shadow a real blob published by the curator.
  const account = curatorAccount();
  if (account) {
    try {
      const mod = await import("@shelby-protocol/sdk/browser");
      const apiKey = process.env.NEXT_PUBLIC_SHELBY_API_KEY;
      const client = new mod.ShelbyBlobClient({
        apiKey: apiKey && apiKey !== "shelby_YOUR_KEY_HERE" ? apiKey : undefined,
        network: "shelbynet",
      });
      const buf = await (client as unknown as {
        download: (args: { account: string; blobName: string }) => Promise<Uint8Array | ArrayBuffer>;
      }).download({ account, blobName });
      const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
      const blob = decodePuzzleBlob(bytes);
      if (typeof window !== "undefined") {
        const b64 = btoa(String.fromCharCode(...bytes));
        localStorage.setItem(cacheKey(level, date), b64);
      }
      return { ...blob, source: "shelby" };
    } catch (err) {
      console.debug("[shelby:fallback]", err);
    }
  } else {
    console.debug(
      "[shelby:fallback] no curator account configured (set NEXT_PUBLIC_CURATOR_ADDRESS)",
    );
  }

  // 2) localStorage cache
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem(cacheKey(level, date));
    if (cached) {
      try {
        const buf = Uint8Array.from(atob(cached), (c) => c.charCodeAt(0));
        const blob = decodePuzzleBlob(buf);
        return { ...blob, source: "cache" };
      } catch {
        localStorage.removeItem(cacheKey(level, date));
      }
    }
  }

  // 3) deterministic generator
  const fb = fallback(level);
  if (typeof window !== "undefined") {
    const buf = encodePuzzleBlob(fb);
    const b64 = btoa(String.fromCharCode(...buf));
    localStorage.setItem(cacheKey(level, date), b64);
  }
  return fb;
}