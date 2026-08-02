import { truncate } from "./utils";

export interface FaucetResult {
  ok: boolean;
  message: string;
  txHashes?: string[];
  retryAfterSec?: number;
}

const RATE_LIMIT_MS = 30_000;
const APT_TS_KEY = "shelby-faucet-apt-ts";
const USD_TS_KEY = "shelby-faucet-usd-ts";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function remainingWait(key: string): number {
  if (!isBrowser()) return 0;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const last = Number(raw);
    if (!Number.isFinite(last)) return 0;
    const left = RATE_LIMIT_MS - (Date.now() - last);
    return left > 0 ? Math.ceil(left / 1000) : 0;
  } catch {
    return 0;
  }
}

function markCalled(key: string): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // ignore
  }
}

function parseRetryAfter(res: Response): number | undefined {
  const h = res.headers.get("Retry-After");
  if (!h) return undefined;
  const sec = Number(h);
  if (Number.isFinite(sec) && sec > 0) return Math.ceil(sec);
  const when = Date.parse(h);
  if (!Number.isNaN(when)) {
    return Math.max(1, Math.ceil((when - Date.now()) / 1000));
  }
  return undefined;
}

/**
 * Request testnet APT via same-origin API proxy (real Aptos faucet upstream).
 * Client rate-limit: 30s between calls; honors Retry-After when present.
 */
export async function requestAptFaucet(
  address: string,
  amountOcta = 100_000_000,
): Promise<FaucetResult> {
  if (!address) {
    return { ok: false, message: "Wallet address required" };
  }

  const wait = remainingWait(APT_TS_KEY);
  if (wait > 0) {
    return { ok: false, message: `Please wait ${wait}s`, retryAfterSec: wait };
  }

  try {
    const res = await fetch("/api/faucet/apt", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ address, amount: amountOcta }),
    });
    const retryAfter = parseRetryAfter(res);
    const data = (await res.json().catch(() => ({}))) as FaucetResult;

    if (retryAfter) {
      markCalled(APT_TS_KEY);
      return {
        ok: false,
        message: `Please wait ${retryAfter}s`,
        retryAfterSec: retryAfter,
      };
    }

    if (!res.ok || !data.ok) {
      return {
        ok: false,
        message: truncate(data.message || `HTTP ${res.status}`),
        retryAfterSec: data.retryAfterSec,
      };
    }

    markCalled(APT_TS_KEY);
    return {
      ok: true,
      message: data.message || `Minted ${amountOcta / 1e8} APT`,
      txHashes: data.txHashes,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: truncate(msg) };
  }
}

/**
 * Request shelbyUSD via same-origin API proxy (real Shelby faucet upstream).
 */
export async function requestShelbyUsdFaucet(address: string): Promise<FaucetResult> {
  if (!address) {
    return { ok: false, message: "Wallet address required" };
  }

  const wait = remainingWait(USD_TS_KEY);
  if (wait > 0) {
    return { ok: false, message: `Please wait ${wait}s`, retryAfterSec: wait };
  }

  try {
    const res = await fetch("/api/faucet/shelbyusd", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ address }),
    });
    const retryAfter = parseRetryAfter(res);
    const data = (await res.json().catch(() => ({}))) as FaucetResult;

    if (retryAfter) {
      markCalled(USD_TS_KEY);
      return {
        ok: false,
        message: `Please wait ${retryAfter}s`,
        retryAfterSec: retryAfter,
      };
    }

    if (!res.ok || !data.ok) {
      return {
        ok: false,
        message: truncate(data.message || `HTTP ${res.status}`),
        retryAfterSec: data.retryAfterSec,
      };
    }

    markCalled(USD_TS_KEY);
    return {
      ok: true,
      message: data.message || "shelbyUSD faucet request accepted",
      txHashes: data.txHashes,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: truncate(msg) };
  }
}
