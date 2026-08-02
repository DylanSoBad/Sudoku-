/**
 * Solve replay blob codec + Shelby/local storage helpers.
 * Blob: shelby-sudoku-solve-<addr>-<lvl>-<ts>.bin
 */

import {
  fetchBlobBytes,
  getBrowserClient,
  uploadRawBlob,
  type ShelbyUploadSigner,
} from "./shelby";
import type { Board } from "./sudoku";

export interface ReplayMove {
  cell: number;
  value: number;
  ts: number;
}

export interface SolveReplay {
  v: 1;
  addr: string;
  level: number;
  puzzle: Board;
  solution: Board;
  moves: ReplayMove[];
  createdAt: number;
  hintsUsed: number;
  timeMs: number;
}

const REPLAY_CACHE_PREFIX = "shelby-sudoku-replay:";
const REPLAY_INDEX_KEY = "shelby-sudoku-replay-index";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function replayBlobName(addr: string, level: number, ts: number): string {
  const safe = addr.replace(/[^a-zA-Z0-9]/g, "").slice(0, 42) || "guest";
  return `shelby-sudoku-solve-${safe}-${level}-${ts}.bin`;
}

export function encodeReplayBlob(replay: SolveReplay): Uint8Array {
  const json = JSON.stringify(replay);
  return new TextEncoder().encode(json);
}

export function decodeReplayBlob(bytes: Uint8Array): SolveReplay {
  const text = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(text) as SolveReplay;
  if (parsed.v !== 1 || !Array.isArray(parsed.moves)) {
    throw new Error("Invalid replay blob");
  }
  return parsed;
}

function cacheKey(blobName: string): string {
  return `${REPLAY_CACHE_PREFIX}${blobName}`;
}

export function cacheReplayLocal(blobName: string, bytes: Uint8Array): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(cacheKey(blobName), JSON.stringify(Array.from(bytes)));
    const raw = localStorage.getItem(REPLAY_INDEX_KEY);
    const index = (raw ? JSON.parse(raw) : {}) as Record<string, string>;
    // index by level+addr → latest blob
    const replay = decodeReplayBlob(bytes);
    index[`${replay.level}:${replay.addr}`] = blobName;
    localStorage.setItem(REPLAY_INDEX_KEY, JSON.stringify(index));
  } catch {
    console.warn("[shelby:fallback] replay localStorage cache failed");
  }
}

export function readReplayCache(blobName: string): Uint8Array | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(cacheKey(blobName));
    if (!raw) return null;
    return new Uint8Array(JSON.parse(raw) as number[]);
  } catch {
    return null;
  }
}

export function lookupReplayBlobName(level: number, addr: string): string | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(REPLAY_INDEX_KEY);
    if (!raw) return null;
    const index = JSON.parse(raw) as Record<string, string>;
    return index[`${level}:${addr}`] ?? null;
  } catch {
    return null;
  }
}

export interface UploadReplayResult {
  blobName: string;
  txHash: string | null;
  source: "shelby" | "local";
}

/**
 * Upload solve replay when wallet+SDK available; else cache local + warn.
 */
export async function uploadSolveReplay(
  replay: SolveReplay,
  signer: ShelbyUploadSigner | null,
): Promise<UploadReplayResult> {
  const blobName = replayBlobName(replay.addr, replay.level, replay.createdAt);
  const bytes = encodeReplayBlob(replay);
  cacheReplayLocal(blobName, bytes);

  const client = await getBrowserClient();
  if (!client || !signer) {
    console.warn("[shelby:fallback] replay cached locally (no wallet/SDK)");
    return { blobName, txHash: null, source: "local" };
  }

  try {
    const owner = signer?.address ?? process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS?.trim() ?? "local";
    const result = await uploadRawBlob({ account: owner, blobName, bytes });
    return { blobName, txHash: result.txHash ?? null, source: "shelby" };
  } catch (err) {
    console.warn("[shelby:fallback] replay upload failed — kept local cache", err);
    return { blobName, txHash: null, source: "local" };
  }
}

/**
 * Fetch replay: Shelby → local cache. `blobName` optional if indexed.
 */
export async function fetchSolveReplay(
  level: number,
  addr: string,
  blobName?: string,
): Promise<SolveReplay | null> {
  const name = blobName || lookupReplayBlobName(level, addr);
  if (!name) {
    // Try common local scan — last resort walk cache keys
    if (isBrowser()) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key?.startsWith(REPLAY_CACHE_PREFIX)) continue;
          const bytes = readReplayCache(key.slice(REPLAY_CACHE_PREFIX.length));
          if (!bytes) continue;
          const replay = decodeReplayBlob(bytes);
          if (replay.level === level && replay.addr === addr) return replay;
        }
      } catch {
        // ignore
      }
    }
    return null;
  }

  const owner =
    process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS?.trim() ||
    addr ||
    "local";

  try {
    const bytes = await fetchBlobBytes({ account: owner, blobName: name });
    if (bytes && bytes.length > 0) {
      const replay = decodeReplayBlob(bytes);
      cacheReplayLocal(name, bytes);
      return replay;
    }
  } catch (err) {
    console.warn("[shelby:fallback] replay Shelby fetch failed", err);
  }

  // Also try signer addr as owner
  if (addr && addr !== owner) {
    try {
      const bytes = await fetchBlobBytes({ account: addr, blobName: name });
      if (bytes && bytes.length > 0) {
        const replay = decodeReplayBlob(bytes);
        cacheReplayLocal(name, bytes);
        return replay;
      }
    } catch {
      // ignore
    }
  }

  const cached = readReplayCache(name);
  if (cached) {
    console.warn("[shelby:fallback] replay loaded from local cache");
    return decodeReplayBlob(cached);
  }

  return null;
}
