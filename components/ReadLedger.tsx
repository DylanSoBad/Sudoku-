import type { PuzzleSourceName } from "@/lib/shelby";

export function recordRead(level: number, source: PuzzleSourceName): void {
  // Re-export shim for the lowercase tree.
  // The real implementation lives in `lib/shelby.ts` and is invoked by the
  // hooks; this placeholder keeps the legacy import surface stable.
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem("shelby-sudoku-read-count");
  const next = (Number(raw) || 0) + 1;
  window.localStorage.setItem("shelby-sudoku-read-count", String(next));
  const logRaw = window.localStorage.getItem("shelby-sudoku-read-log");
  const log = logRaw
    ? (JSON.parse(logRaw) as Array<{ ts: number; level: number; source: string }>)
    : [];
  log.push({ ts: Date.now(), level, source });
  if (log.length > 200) log.splice(0, log.length - 200);
  window.localStorage.setItem("shelby-sudoku-read-log", JSON.stringify(log));
}
