/**
 * fetchPuzzle: load puzzle data for a level with three-tier fallback.
 *
 * 1) Shelby download (`@shelby-protocol/sdk/browser`), hard-capped at
 *    SHELBY_TIMEOUT_MS. Needs a curator address; every other tier does not.
 * 2) localStorage cache (so reopening a level is instant + counts as a read).
 * 3) Deterministic generator (mulberry32 seeded from FNV-1a of the level).
 *
 * Each tier swallows its own failures and returns null so the cascade always
 * reaches tier 3. `fetchPuzzle` therefore resolves on every path and never
 * rejects or stays pending — a stalled Shelby request used to hang the level
 * page on "Loading puzzle" indefinitely.
 */
import { decodePuzzleBlob, encodePuzzleBlob, type PuzzleBlob } from "./blob-layout";
import type { PuzzleSourceName } from "./shelby";
import {
  difficultyForLevel,
  HINT_COST_SUSD,
  REWARD_PER_LEVEL_SUSD,
} from "./tokenomics";
import { fnv1a, generatePuzzle } from "./sudoku";
import { withTimeout } from "./utils";

const CACHE_PREFIX = "shelby-sudoku-cache:";

/** Tier 1 gets this long to settle before the cascade moves on. */
export const SHELBY_TIMEOUT_MS = 4_000;

/**
 * Blobs whose Shelby fetch already failed in this session. Without this, every
 * navigation re-pays the full timeout before falling through, so a level page
 * would sit on "Loading puzzle" for four seconds each time Shelby is
 * unreachable. Module-scoped, so a page reload retries from scratch.
 */
const shelbyMisses = new Set<string>();

export interface FetchedPuzzle extends PuzzleBlob {
  source: PuzzleSourceName;
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
const DEFAULT_CURATOR =
  "0x071a8a3d2ca013623dba02737a3824d898756eddad5f991aa55d2155c45fa20a";

function curatorAccount(): string {
  return (
    process.env.NEXT_PUBLIC_CURATOR_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS?.trim() ||
    DEFAULT_CURATOR
  );
}

function toBase64(bytes: Uint8Array): string {
  // Chunked so a large blob cannot blow the call stack via argument spread.
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function writeCache(level: number, date: string, bytes: Uint8Array): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(cacheKey(level, date), toBase64(bytes));
  } catch {
    /* quota or private-mode storage denial is not fatal */
  }
}

/**
 * Deterministic puzzle for `level`. Pure and synchronous, so it is always a
 * safe terminal tier — also exported for the level page watchdog.
 */
export function generateFallbackPuzzle(level: number): FetchedPuzzle {
  const diff = difficultyForLevel(level);
  const { puzzle, solution } = generatePuzzle(level, fnv1a(level + "-" + todayUTC()));
  return {
    level,
    difficulty: diff,
    hintCost: HINT_COST_SUSD,
    reward: REWARD_PER_LEVEL_SUSD,
    puzzle,
    solution,
    ts: Date.now(),
    source: "generated",
  };
}

/**
 * Same-origin curator mirror written by `scripts/seed-puzzles.mjs`.
 * Used when the Shelby SDK download is unavailable (missing API key, network
 * timeout, etc.) so production still serves the curated blob bytes.
 */
async function tryPublicMirror(blobName: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`/puzzles/${encodeURIComponent(blobName)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Shelby download performed by the server with the private `SHELBY_API_KEY`.
 * Lets production read real Shelby blobs without shipping the key to the
 * browser; 404 means Shelby is unconfigured or unreachable.
 */
async function tryServerShelby(blobName: string): Promise<Uint8Array | null> {
  try {
    const res = await withTimeout(
      fetch(`/api/blob/${encodeURIComponent(blobName)}`),
      SHELBY_TIMEOUT_MS,
      `shelby proxy ${blobName}`,
    );
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    console.warn("[shelby:fallback] proxy", err);
    return null;
  }
}

/** Tier 1. Curated blob via Shelby SDK, then public/puzzles mirror. */
async function tierShelby(level: number, date: string): Promise<FetchedPuzzle | null> {
  if (typeof window === "undefined") return null;

  const blobName = dailyBlobName(level, date);
  if (shelbyMisses.has(blobName)) return null;

  const account = curatorAccount();

  if (account) {
    try {
      // The dynamic import is inside the timeout too: a stalled chunk fetch
      // would otherwise hang the cascade just as a stalled download did.
      const bytes = await withTimeout(
        (async () => {
          const mod = await import("@shelby-protocol/sdk/browser");
          const { Network } = await import("@aptos-labs/ts-sdk");
          const apiKey = process.env.NEXT_PUBLIC_SHELBY_API_KEY;
          const key =
            apiKey && apiKey !== "shelby_YOUR_KEY_HERE" ? apiKey : undefined;
          const client = new mod.ShelbyClient({
            network: Network.SHELBYNET,
            apiKey: key,
            rpc: {
              baseUrl: "https://api.shelbynet.shelby.xyz/shelby",
              apiKey: key,
            },
            indexer: {
              baseUrl:
                "https://api.shelbynet.aptoslabs.com/nocode/v1/public/cmforrguw0042s601fn71f9l2/v1/graphql",
              apiKey: key,
            },
          });
          const blob = await client.download({ account, blobName });
          const data =
            (blob as { data?: Uint8Array | ArrayBuffer }).data ??
            (blob as unknown as Uint8Array | ArrayBuffer);
          return data instanceof Uint8Array ? data : new Uint8Array(data);
        })(),
        SHELBY_TIMEOUT_MS,
        `shelby download ${blobName}`,
      );

      const blob = decodePuzzleBlob(bytes);
      writeCache(level, date, bytes);
      return { ...blob, source: "shelby" };
    } catch (err) {
      console.warn("[shelby:fallback]", err);
    }
  } else {
    console.warn(
      "[shelby:fallback]",
      "no curator account configured — trying public puzzle mirror",
    );
  }

  // Server-side Shelby read: no public API key needed, still real Shelby bytes.
  const viaServer = await tryServerShelby(blobName);
  if (viaServer) {
    try {
      const blob = decodePuzzleBlob(viaServer);
      writeCache(level, date, viaServer);
      return { ...blob, source: "shelby" };
    } catch (err) {
      console.warn("[shelby:fallback] proxy decode failed", err);
    }
  }

  const mirrored = await tryPublicMirror(blobName);
  if (mirrored) {
    try {
      const blob = decodePuzzleBlob(mirrored);
      writeCache(level, date, mirrored);
      return { ...blob, source: "mirror" };
    } catch (err) {
      console.warn("[shelby:fallback] public mirror decode failed", err);
    }
  }

  shelbyMisses.add(blobName);
  return null;
}

/** Tier 2. Runs regardless of wallet or curator configuration. */
function tierCache(level: number, date: string): FetchedPuzzle | null {
  if (typeof window === "undefined") return null;
  let cached: string | null = null;
  try {
    cached = localStorage.getItem(cacheKey(level, date));
  } catch {
    return null;
  }
  if (!cached) return null;
  try {
    const buf = Uint8Array.from(atob(cached), (c) => c.charCodeAt(0));
    return { ...decodePuzzleBlob(buf), source: "cache" };
  } catch (err) {
    console.warn("[shelby:fallback]", err);
    try {
      localStorage.removeItem(cacheKey(level, date));
    } catch {
      /* ignore */
    }
    return null;
  }
}

/** Tier 3. Runs regardless of wallet state and cannot fail. */
function tierGenerated(level: number, date: string): FetchedPuzzle {
  const fb = generateFallbackPuzzle(level);
  try {
    writeCache(level, date, encodePuzzleBlob(fb));
  } catch {
    /* encoding the cache copy must never block rendering */
  }
  return fb;
}

export async function fetchPuzzle(level: number): Promise<FetchedPuzzle> {
  const date = todayUTC();

  // Shelby first so a locally generated puzzle can never permanently shadow a
  // real blob published by the curator.
  const fromShelby = await tierShelby(level, date);
  if (fromShelby) return fromShelby;

  const fromCache = tierCache(level, date);
  if (fromCache) return fromCache;

  return tierGenerated(level, date);
}