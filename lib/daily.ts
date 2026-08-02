/**
 * Daily challenge helpers — blob name shelby-sudoku-daily-YYYYMMDD (UTC).
 */
import {
  countSolutions,
  decodePuzzleBlob,
  encodePuzzleBlob,
  generatePuzzleWithSeed,
  getLevelMeta,
  type Board,
  type GeneratedPuzzle,
  type LevelMeta,
} from "./sudoku";
import {
  fetchBlobBytes,
  uploadRawBlob,
  type ShelbySigner,
} from "./shelby";
import { utcDateKey } from "./streak";

const DAILY_CACHE_PREFIX = "shelby-sudoku-daily-cache:";
const DAILY_PROGRESS_KEY = "shelby-sudoku-daily-progress";

export const DAILY_LEVEL = 5;

export type PuzzleSource = "shelby" | "cache" | "generated";
export type ShelbyUploadSigner = ShelbySigner;

export interface DailyPuzzle {
  dateKey: string;
  blobName: string;
  puzzle: Board;
  solution: Board;
  meta: LevelMeta;
  source: PuzzleSource;
  reward: number;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function dailyBlobName(dateKey = utcDateKey()): string {
  return `shelby-sudoku-daily-${dateKey}`;
}

export function dailySeed(dateKey = utcDateKey()): string {
  return `shelby-sudoku-daily-${dateKey}`;
}

function readDailyCache(dateKey: string): Uint8Array | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(`${DAILY_CACHE_PREFIX}${dateKey}`);
    if (!raw) return null;
    return new Uint8Array(JSON.parse(raw) as number[]);
  } catch {
    return null;
  }
}

function writeDailyCache(dateKey: string, bytes: Uint8Array): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(
      `${DAILY_CACHE_PREFIX}${dateKey}`,
      JSON.stringify(Array.from(bytes)),
    );
  } catch {
    /* ignore */
  }
}

function withDoubleReward(meta: LevelMeta): LevelMeta {
  return { ...meta, reward: Math.round(meta.reward * 2 * 100) / 100 };
}

function ensureUnique(puzzle: GeneratedPuzzle, seedStr: string): GeneratedPuzzle {
  if (countSolutions(puzzle.puzzle) === 1) return puzzle;
  return generatePuzzleWithSeed(DAILY_LEVEL, fnv1a(seedStr + "-retry"));
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export async function fetchDailyPuzzle(dateKey = utcDateKey()): Promise<DailyPuzzle> {
  const blobName = dailyBlobName(dateKey);
  const owner =
    process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS?.trim() || "local";
  const baseMeta = withDoubleReward(getLevelMeta(DAILY_LEVEL));

  if (owner !== "local") {
    try {
      const bytes = await fetchBlobBytes({ account: owner, blobName });
      if (bytes && bytes.length > 0) {
        const decoded = decodePuzzleBlob(bytes);
        if (countSolutions(decoded.puzzle) !== 1) {
          console.warn("[shelby:fallback] daily blob not unique — regenerating");
        } else {
          writeDailyCache(dateKey, bytes);
          const meta = withDoubleReward(decoded.meta ?? baseMeta);
          return {
            dateKey,
            blobName,
            puzzle: decoded.puzzle,
            solution: decoded.solution,
            meta,
            source: "shelby",
            reward: meta.reward,
          };
        }
      }
    } catch (err) {
      console.warn("[shelby:fallback] daily download failed", err);
    }
  } else {
    console.warn("[shelby:fallback] daily — registry not configured");
  }

  const cached = readDailyCache(dateKey);
  if (cached) {
    try {
      const decoded = decodePuzzleBlob(cached);
      const meta = withDoubleReward(decoded.meta ?? baseMeta);
      return {
        dateKey,
        blobName,
        puzzle: decoded.puzzle,
        solution: decoded.solution,
        meta,
        source: "cache",
        reward: meta.reward,
      };
    } catch {
      /* corrupt */
    }
  }

  console.warn(`[shelby:fallback] generating daily ${dateKey} locally`);
  const seedStr = dailySeed(dateKey);
  const seed = fnv1a(seedStr);
  let generated = ensureUnique(generatePuzzleWithSeed(DAILY_LEVEL, seed), seedStr);
  generated = { ...generated, meta: withDoubleReward(generated.meta) };
  const encoded = encodePuzzleBlob(generated as never);
  writeDailyCache(dateKey, encoded);

  return {
    dateKey,
    blobName,
    puzzle: generated.puzzle,
    solution: generated.solution,
    meta: generated.meta,
    source: "generated",
    reward: generated.meta.reward,
  };
}

/** Generate + encode today's daily for curator upload. */
export function buildDailyPuzzle(dateKey = utcDateKey()): GeneratedPuzzle {
  const seedStr = dailySeed(dateKey);
  const seed = fnv1a(seedStr);
  const generated = ensureUnique(generatePuzzleWithSeed(DAILY_LEVEL, seed), seedStr);
  return { ...generated, meta: withDoubleReward(generated.meta) };
}

export async function uploadDailyPuzzle(
  signer: ShelbyUploadSigner,
  dateKey = utcDateKey(),
): Promise<{ blobName: string; txHash: string }> {
  const puzzle = buildDailyPuzzle(dateKey);
  const blobName = dailyBlobName(dateKey);
  const blobData = encodePuzzleBlob(puzzle as never);
  const owner =
    process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS?.trim() || "local";
  await uploadRawBlob({ account: owner, blobName, bytes: blobData });
  // The signer may export putBlob; opportunistically call it.
  if (signer?.putBlob) {
    const r = await signer.putBlob({ account: owner, blobName, bytes: blobData });
    writeDailyCache(dateKey, blobData);
    return { blobName, txHash: r.txHash };
  }
  writeDailyCache(dateKey, blobData);
  return { blobName, txHash: "local-upload" };
}

export function isDailyCompleted(dateKey = utcDateKey()): boolean {
  if (!isBrowser()) return false;
  try {
    const raw = localStorage.getItem(DAILY_PROGRESS_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, boolean>;
    return Boolean(map[dateKey]);
  } catch {
    return false;
  }
}

export function markDailyComplete(dateKey = utcDateKey()): void {
  if (!isBrowser()) return;
  try {
    const raw = localStorage.getItem(DAILY_PROGRESS_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, boolean>;
    map[dateKey] = true;
    localStorage.setItem(DAILY_PROGRESS_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent("shelby:daily", { detail: { dateKey } }));
  } catch {
    /* ignore */
  }
}
