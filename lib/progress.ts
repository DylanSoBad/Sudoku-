/**
 * Progress: per-address level-unlock map, signed with HMAC-SHA-256 over
 * "<address>:<level>" using NEXT_PUBLIC_PROGRESS_SALT.
 *
 * Per README: storage key "shelby-sudoku-progress", casual anti-tamper only.
 */

export const PROGRESS_KEY = "shelby-sudoku-progress";
export const PROGRESS_SIG_PREFIX = "shelby-sudoku-progress-sig";

interface ProgressV1 {
  v: 1;
  cleared: number[];
  ts: number;
}

function getSalt(): string {
  return process.env.NEXT_PUBLIC_PROGRESS_SALT ?? "change-me-to-a-long-random-string";
}

function hasWebCrypto(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";
}

async function hmacHex(secret: string, msg: string): Promise<string> {
  if (!hasWebCrypto()) return "";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isUnlocked(address: string | undefined, level: number): boolean {
  if (!address) return level === 1;
  if (level === 1) return true;
  return loadProgress(address).includes(level - 1);
}

export function loadProgress(address: string): number[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(PROGRESS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, ProgressV1>;
    const entry = parsed[address.toLowerCase()];
    if (!entry || entry.v !== 1) return [];
    return [...entry.cleared].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

function saveProgress(address: string, cleared: number[]): void {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(PROGRESS_KEY);
  let parsed: Record<string, ProgressV1> = {};
  if (raw) {
    try {
      const obj: unknown = JSON.parse(raw);
      if (obj && typeof obj === "object") parsed = obj as Record<string, ProgressV1>;
    } catch {
      parsed = {};
    }
  }
  parsed[address.toLowerCase()] = { v: 1, cleared: [...cleared].sort((a, b) => a - b), ts: Date.now() };
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(parsed));
}

export async function markCleared(address: string, level: number): Promise<void> {
  if (typeof window === "undefined") return;
  if (!address) return;
  const lower = address.toLowerCase();
  const cleared = loadProgress(address);
  if (cleared.includes(level)) return;
  const next = [...cleared, level];
  saveProgress(address, next);
  const sig = await hmacHex(getSalt(), `${lower}:${level}`);
  if (sig) {
    window.localStorage.setItem(`${PROGRESS_SIG_PREFIX}:${lower}:${level}`, sig);
  }
  const nextLevel = level + 1;
  if (!cleared.includes(nextLevel)) {
    const sigNext = await hmacHex(getSalt(), `${lower}:${nextLevel}`);
    if (sigNext) {
      window.localStorage.setItem(`${PROGRESS_SIG_PREFIX}:${lower}:${nextLevel}`, sigNext);
    }
  }
}

export function clearedCount(address: string | undefined): number {
  if (!address) return 0;
  return loadProgress(address).length;
}
