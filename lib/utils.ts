/** Generic class-name joiner (replaces clsx + tailwind-merge). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((p): p is string => Boolean(p)).join(" ");
}

export function short(addr?: string, headLen = 6, tailLen = 4): string {
  if (!addr) return "";
  if (addr.length <= headLen + tailLen + 1) return addr;
  return `${addr.slice(0, headLen)}…${addr.slice(-tailLen)}`;
}

export function truncate(s: string, n = 80): string {
  if (s.length <= n) return s;
  return `${s.slice(0, Math.max(0, n - 1))}…`;
}

export function formatMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function explorerTxUrl(hash: string, network = "testnet"): string {
  return `https://explorer.aptoslabs.com/txn/${hash}?network=${network}`;
}

export function dailyBlobName(level: number, dateKey: string): string {
  return `shelby-sudoku-level-${level}-${dateKey}`;
}

export function todayKey(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function fmtNumber(n: number, digits = 2): string {
  return n.toFixed(digits);
}
