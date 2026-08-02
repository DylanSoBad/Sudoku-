/**
 * Daily streak counter in localStorage. Increments once per UTC day on solve.
 */
const KEY = "shelby-sudoku-streak";

interface State {
  lastDayUTC: string;
  count: number;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): State {
  if (typeof window === "undefined") return { lastDayUTC: "", count: 0 };
  const raw = localStorage.getItem(KEY);
  if (!raw) return { lastDayUTC: "", count: 0 };
  try { return JSON.parse(raw) as State; } catch { return { lastDayUTC: "", count: 0 }; }
}

function save(s: State) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function currentStreak(): number {
  const s = load();
  if (!s.lastDayUTC) return 0;
  const last = new Date(s.lastDayUTC + "T00:00:00Z").getTime();
  const today = new Date(todayUTC() + "T00:00:00Z").getTime();
  const diffDays = Math.floor((today - last) / 86400000);
  return diffDays <= 1 ? s.count : 0;
}

export function effectiveStreak(): number {
  return currentStreak();
}

export function utcDateKey(): string {
  return todayUTC();
}

export function recordSolveStreak(): number {
  return bumpStreak();
}

export function consumeFreeHint(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem("shelby-sudoku-free-hints");
  const left = raw ? Number(raw) : 0;
  if (left <= 0) return false;
  window.localStorage.setItem("shelby-sudoku-free-hints", String(left - 1));
  return true;
}

export function grantFreeHint(): void {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem("shelby-sudoku-free-hints");
  const left = raw ? Number(raw) : 0;
  window.localStorage.setItem("shelby-sudoku-free-hints", String(left + 1));
}

export function getHintPricing(base: number): { price: number; freeHintAvailable: boolean } {
  if (typeof window === "undefined") return { price: base, freeHintAvailable: false };
  const season = window.localStorage.getItem("shelby-sudoku-season-pass") === "1";
  const free = consumeFreeHint();
  const price = season ? base / 2 : base;
  return { price, freeHintAvailable: free };
}

export function bumpStreak(): number {
  const s = load();
  const today = todayUTC();
  if (s.lastDayUTC === today) return s.count;
  const last = s.lastDayUTC ? new Date(s.lastDayUTC + "T00:00:00Z").getTime() : 0;
  const todayMs = new Date(today + "T00:00:00Z").getTime();
  const diff = last ? Math.floor((todayMs - last) / 86400000) : 0;
  const next: State = {
    lastDayUTC: today,
    count: diff === 1 ? s.count + 1 : 1,
  };
  save(next);
  return next.count;
}