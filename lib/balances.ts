/**
 * Reads APT and shelbyUSD balances for the connected wallet.
 *
 * APT — from `0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>` directly.
 * sUSD — from the shelbyUSD fungible asset, looked up by metadata address
 *        derived from `NEXT_PUBLIC_SHELBY_USD_MODULE`. Implementation lives in
 *        `lib/aptos.ts` so it can be shared by server and client code.
 *
 * No local fallback for balances — the spec demands real chain calls.
 */
import { getAptosClient, getAptBalance, getShelbyUsdBalance } from "./aptos";

export {
  getAptosClient,
  aptosClient,
  getAptBalance,
  getShelbyUsdBalance,
  shelbyUsdMetadataAddress,
  shelbyUsdModuleAddress,
  shelbyUsdDecimalsValue,
} from "./aptos";

export interface Balances {
  apt: number;        // APT (1e8 octas)
  shelbyUSD: number;  // shelbyUSD (6 decimals)
}

/**
 * Fetch both balances in parallel. Throws if either RPC call fails; callers
 * (useBalances hook) convert the error into a user-visible toast.
 */
export async function loadBalances(address: string): Promise<Balances> {
  if (!address) return { apt: 0, shelbyUSD: 0 };
  const [apt, shelbyUSD] = await Promise.all([
    getAptBalance(address),
    getShelbyUsdBalance(address),
  ]);
  return { apt, shelbyUSD };
}

// ─── Run history (kept for compat with previous callers) ──────────────────

export interface Entry {
  address: string;
  addr?: string;
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

export function recordRun(
  address: string,
  level: number,
  ms: number,
  hintsUsed?: number,
  source?: string,
): void {
  if (typeof window === "undefined") return;
  const KEY = "shelby-sudoku-runs";
  const raw = window.localStorage.getItem(KEY);
  const list: Array<Entry> = raw ? (JSON.parse(raw) as Entry[]) : [];
  list.push({
    address: address.toLowerCase(),
    addr: address.toLowerCase(),
    level,
    ms,
    time_ms: ms,
    hints_used: hintsUsed ?? 0,
    ts: Date.now(),
    source: source ?? "local",
  });
  if (list.length > 200) list.splice(0, list.length - 200);
  window.localStorage.setItem(KEY, JSON.stringify(list));
}
