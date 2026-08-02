import { REFERRAL_BONUS_SUSD } from "@/lib/tokenomics";

const CODE_KEY = "shelby-sudoku-referral-code";
const APPLIED_KEY = "shelby-sudoku-referral-applied";
const CREDITS_KEY = "shelby-sudoku-local-credits";

/** Short invite code from wallet address. */
export function inviteCodeFromAddress(address: string): string {
  const clean = address.replace(/^0x/, "").toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
}

export function getStoredInviteCode(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CODE_KEY);
}

export function ensureInviteCode(address: string): string {
  const code = inviteCodeFromAddress(address);
  localStorage.setItem(CODE_KEY, code);
  return code;
}

export function hasAppliedReferral(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(APPLIED_KEY);
}

export function getLocalCredit(): number {
  if (typeof window === "undefined") return 0;
  const n = Number(localStorage.getItem(CREDITS_KEY) || "0");
  return Number.isFinite(n) ? n : 0;
}

function addLocalCredit(amount: number): void {
  const next = getLocalCredit() + amount;
  localStorage.setItem(CREDITS_KEY, String(next));
  window.dispatchEvent(new CustomEvent("shelby:credits"));
}

export interface ApplyReferralResult {
  ok: boolean;
  message: string;
  bonus: number;
  localOnly: boolean;
}

/**
 * Apply an invite code once per browser. Both referrer (stored code match)
 * and referee get local shelbyUSD credit. On-chain payout only when registry set.
 */
export function applyReferralCode(
  code: string,
  myAddress: string | null,
): ApplyReferralResult {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed || trimmed.length < 4) {
    return { ok: false, message: "Invalid code", bonus: 0, localOnly: true };
  }
  if (hasAppliedReferral()) {
    return { ok: false, message: "Referral already used", bonus: 0, localOnly: true };
  }
  if (myAddress && inviteCodeFromAddress(myAddress) === trimmed) {
    return { ok: false, message: "Cannot use your own code", bonus: 0, localOnly: true };
  }

  localStorage.setItem(APPLIED_KEY, JSON.stringify({ code: trimmed, at: Date.now() }));
  addLocalCredit(REFERRAL_BONUS_SUSD);

  // Referrer credit slot (best-effort local): store pending credits keyed by code
  try {
    const pendingKey = "shelby-sudoku-referral-pending";
    const pending = JSON.parse(localStorage.getItem(pendingKey) || "{}") as Record<
      string,
      number
    >;
    pending[trimmed] = (pending[trimmed] ?? 0) + REFERRAL_BONUS_SUSD;
    localStorage.setItem(pendingKey, JSON.stringify(pending));
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    message: `+${REFERRAL_BONUS_SUSD} shelbyUSD local bonus credit`,
    bonus: REFERRAL_BONUS_SUSD,
    localOnly: true,
  };
}

/** Claim pending referrer credits if our code matches. */
export function claimPendingReferrerCredit(address: string): number {
  const code = inviteCodeFromAddress(address);
  try {
    const pendingKey = "shelby-sudoku-referral-pending";
    const pending = JSON.parse(localStorage.getItem(pendingKey) || "{}") as Record<
      string,
      number
    >;
    const amount = pending[code] ?? 0;
    if (amount > 0) {
      addLocalCredit(amount);
      delete pending[code];
      localStorage.setItem(pendingKey, JSON.stringify(pending));
      return amount;
    }
  } catch {
    /* ignore */
  }
  return 0;
}
