import { SEASON_PASS } from "@/lib/tokenomics";

const PASS_KEY = "shelby-sudoku-season-pass";

export interface SeasonPassState {
  expiresAt: number;
  purchasedAt: number;
  source: "local" | "chain";
  txHash?: string;
}

export function getSeasonPass(): SeasonPassState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PASS_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as SeasonPassState;
    if (!state.expiresAt) return null;
    return state;
  } catch {
    return null;
  }
}

export function isSeasonPassActive(): boolean {
  const pass = getSeasonPass();
  if (!pass) return false;
  return pass.expiresAt > Date.now();
}

export function purchaseSeasonPassLocal(txHash?: string, source: "local" | "chain" = "local"): SeasonPassState {
  const now = Date.now();
  const state: SeasonPassState = {
    purchasedAt: now,
    expiresAt: now + SEASON_PASS.durationDays * 24 * 60 * 60 * 1000,
    source,
    txHash,
  };
  localStorage.setItem(PASS_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("shelby:season-pass"));
  return state;
}

export function seasonPassHintMultiplier(): number {
  return isSeasonPassActive() ? SEASON_PASS.hintDiscount : 1;
}

export function seasonBoardClass(): string {
  return isSeasonPassActive() ? "board-skin-season" : "";
}
