/**
 * Local leaderboard keyed by level. Top 10 by solve time.
 *
 * When Move publishes and an indexer is wired up, replace the read with
 * `indexer.getTopByLevel(level)` but keep the same shape.
 */
const KEY = "shelby-sudoku-leaderboard";

export interface Entry {
  address: string;
  addr?: string;
  at?: number;
  level: number;
  ms: number;
  time_ms?: number;
  hints_used?: number;
  ts: number;
  source?: string;
  owner?: string;
  blobName?: string;
  bytes?: number;
}

function load(): Entry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as Entry[]; } catch { return []; }
}

function save(entries: Entry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export function recordRun(address: string, level: number, ms: number, hintsUsed?: number, source?: string): void {
  const all = load();
  all.push({
    address: address.toLowerCase(),
    addr: address.toLowerCase(),
    level,
    ms,
    time_ms: ms,
    hints_used: hintsUsed ?? 0,
    ts: Date.now(),
    source: source ?? "local",
  });
  save(all);
}

export function topForLevel(level: number, limit = 10): Entry[] {
  return load()
    .filter((e) => e.level === level)
    .sort((a, b) => a.ms - b.ms)
    .slice(0, limit);
}

export function allEntries(): Entry[] {
  return load();
}

export type LeaderboardEntry = Entry;

export function recordLocalLeaderboardEntry(entry: {
  address?: string;
  addr?: string;
  level: number;
  ms?: number;
  time_ms?: number;
  hints_used?: number;
  source?: string;
}): void {
  const address = (entry.address ?? entry.addr ?? "").toLowerCase();
  if (!address) return;
  recordRun(address, entry.level, entry.time_ms ?? entry.ms ?? 0);
}

export function getLeaderboard(level: number, limit = 10): Entry[] {
  return topForLevel(level, limit);
}