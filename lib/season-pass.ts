import { SEASON_PASS } from "@/lib/tokenomics";
import { getAptosClient, registryAddress } from "@/lib/aptos";

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

/** Local cache only — never use alone to choose the on-chain hint entry. */
export function isSeasonPassActive(): boolean {
  const pass = getSeasonPass();
  if (!pass) return false;
  return pass.expiresAt > Date.now();
}

/**
 * Authoritative on-chain check. Returns null when registry is unset or the
 * view fails (caller should fall back to full-price `hint_shop::buy_hint`).
 */
export async function fetchOnChainSeasonPassActive(owner: string): Promise<boolean | null> {
  const registry = registryAddress();
  if (!registry || !owner) return null;
  try {
    const client = getAptosClient();
    const out = await client.view({
      payload: {
        function: `${registry}::season_pass::has_active_pass`,
        typeArguments: [],
        functionArguments: [owner],
      },
    });
    return Boolean(out?.[0]);
  } catch (err) {
    console.warn("[season-pass] has_active_pass view failed", err);
    return null;
  }
}

export function purchaseSeasonPassLocal(
  txHash?: string,
  source: "local" | "chain" = "local",
): SeasonPassState {
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

export function clearSeasonPassLocal(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PASS_KEY);
  window.dispatchEvent(new CustomEvent("shelby:season-pass"));
}

export function seasonPassHintMultiplier(): number {
  return isSeasonPassActive() ? SEASON_PASS.hintDiscount : 1;
}

export function seasonBoardClass(): string {
  return isSeasonPassActive() ? "board-skin-season" : "";
}
