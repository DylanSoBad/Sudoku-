/**
 * Turn wallet / VM errors into something a player can act on.
 *
 * Raw aborts look like `Move abort in 0x71a…::rewards: 0x3ec` or
 * `INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE`, which tell a player nothing about
 * what to do next. Every branch here maps to a concrete next step.
 */

export type TxAction = "claim" | "hint" | "pass" | "referral" | "generic";

export interface FriendlyError {
  /** Short headline, safe for a toast title. */
  title: string;
  /** What the player should do about it. */
  detail: string;
  /** Original message, for the explorer/console. */
  raw: string;
}

/** Abort codes declared in `move/sources/rewards.move`. */
const REWARDS_ABORTS: Record<number, { title: string; detail: string }> = {
  1001: {
    title: "Already claimed",
    detail: "This level's reward is already in your wallet.",
  },
  1003: {
    title: "Rewards not ready",
    detail: "The reward guard is not initialised yet — ping the curator.",
  },
  1004: {
    title: "Claim verification unavailable",
    detail: "The verifier could not sign this solve. Try again in a moment.",
  },
  1005: {
    title: "Claim ticket expired",
    detail: "Tickets last 5 minutes. Press Claim again to get a fresh one.",
  },
  1006: {
    title: "Claim ticket rejected",
    detail: "The signature did not match. Reload the page and claim again.",
  },
  1007: {
    title: "Ticket already used",
    detail: "That claim was already submitted. Check your balance.",
  },
  1008: {
    title: "Daily payout cap reached",
    detail: "The treasury pays out a fixed amount per day. Try again tomorrow.",
  },
};

/** Abort codes declared in `move/sources/referral.move`. */
const REFERRAL_ABORTS: Record<number, { title: string; detail: string }> = {
  2: { title: "Code already used", detail: "This wallet already registered a referral." },
  3: { title: "Unknown code", detail: "That invite code is not registered on-chain." },
  4: { title: "Self referral", detail: "You cannot redeem your own invite code." },
  5: { title: "Already paid", detail: "This wallet already received a referral bonus." },
  6: {
    title: "Clear a level first",
    detail: "Referrals pay out only after you claim at least one level.",
  },
  7: {
    title: "Referrer is full",
    detail: "That code hit its referral cap. Ask for a different one.",
  },
  8: { title: "Invalid code", detail: "Invite codes are 4–32 characters." },
};

function textOf(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    for (const key of ["message", "vm_status", "vmStatus", "error"]) {
      const v = o[key];
      if (typeof v === "string" && v) return v;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

/** `Move abort in 0x…::rewards: 0x3ec` → { module: "rewards", code: 1004 }. */
function parseMoveAbort(text: string): { module: string; code: number } | null {
  const m = /Move abort in [^:]*::([a-z_]+):?\s*(?:0x([0-9a-fA-F]+)|(\d+))/.exec(text);
  if (m) {
    const code = m[2] ? parseInt(m[2], 16) : Number(m[3]);
    if (Number.isFinite(code)) return { module: m[1], code };
  }
  // Some wallets surface only `sub_status` / `abort_code`.
  const alt = /(?:sub_status|abort_code)"?\s*[:=]\s*"?(\d+)/.exec(text);
  if (alt) {
    const code = Number(alt[1]);
    if (Number.isFinite(code)) return { module: "", code };
  }
  return null;
}

function isRejection(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("user rejected") ||
    t.includes("user denied") ||
    t.includes("rejected the request") ||
    t.includes("user canceled") ||
    t.includes("user cancelled") ||
    t.includes("request rejected")
  );
}

export function explainTxError(err: unknown, action: TxAction = "generic"): FriendlyError {
  const raw = textOf(err);
  const upper = raw.toUpperCase();

  if (isRejection(raw)) {
    return { title: "Cancelled in wallet", detail: "You rejected the transaction.", raw };
  }

  if (
    upper.includes("INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE") ||
    upper.includes("CANNOT_PAY_GAS") ||
    upper.includes("OUT_OF_GAS")
  ) {
    return {
      title: "Not enough APT for gas",
      detail: "Get testnet APT from the Aptos faucet, then retry.",
      raw,
    };
  }

  const abort = parseMoveAbort(raw);
  if (abort) {
    if (abort.module === "rewards" || (!abort.module && REWARDS_ABORTS[abort.code])) {
      const hit = REWARDS_ABORTS[abort.code];
      if (hit) return { ...hit, raw };
    }
    if (abort.module === "referral") {
      const hit = REFERRAL_ABORTS[abort.code];
      if (hit) return { ...hit, raw };
    }
    if (abort.module === "season_pass" && abort.code === 3) {
      return {
        title: "Season Pass inactive",
        detail: "Buy or renew the pass before using pass pricing.",
        raw,
      };
    }
    if (abort.module === "fungible_asset" || abort.module === "primary_fungible_store") {
      // EINSUFFICIENT_BALANCE — who is short depends on who pays.
      return action === "claim"
        ? {
            title: "Treasury is empty",
            detail: "The reward pool ran out of shelbyUSD. Ping the curator to top it up.",
            raw,
          }
        : {
            title: "Not enough shelbyUSD",
            detail: "Claim shelbyUSD from the faucet, then retry.",
            raw,
          };
    }
  }

  if (upper.includes("EINSUFFICIENT_BALANCE") || upper.includes("INSUFFICIENT_BALANCE")) {
    return action === "claim"
      ? {
          title: "Treasury is empty",
          detail: "The reward pool ran out of shelbyUSD. Ping the curator to top it up.",
          raw,
        }
      : {
          title: "Not enough shelbyUSD",
          detail: "Claim shelbyUSD from the faucet, then retry.",
          raw,
        };
  }

  if (upper.includes("SEQUENCE_NUMBER") || upper.includes("MEMPOOL")) {
    return {
      title: "Wallet out of sync",
      detail: "A previous transaction is still pending. Wait a few seconds and retry.",
      raw,
    };
  }

  if (
    upper.includes("FETCH") ||
    upper.includes("NETWORKERROR") ||
    upper.includes("TIMEOUT") ||
    upper.includes("ETIMEDOUT")
  ) {
    return {
      title: "Network problem",
      detail: "The Aptos RPC did not respond. Check your connection and retry.",
      raw,
    };
  }

  const fallback: Record<TxAction, string> = {
    claim: "Claim failed",
    hint: "Hint purchase failed",
    pass: "Season Pass purchase failed",
    referral: "Referral failed",
    generic: "Transaction failed",
  };
  return { title: fallback[action], detail: raw, raw };
}

/** One-line form for inline error text. */
export function explainTxErrorText(err: unknown, action: TxAction = "generic"): string {
  const { title, detail } = explainTxError(err, action);
  return detail && detail !== title ? `${title} — ${detail}` : title;
}
