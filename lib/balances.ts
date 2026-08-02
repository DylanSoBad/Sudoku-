/**
 * Reads APT and shelbyUSD balances for the connected wallet.
 *
 * ShelUSD isn't a Move Coin yet on testnet, so we keep a tiny local ledger
 * keyed by address in localStorage. Once Move publishes, swap the shelbyUSD
 * fetcher for `aptos.getAccountCoinData({ coinType: SHELBYUSD_METADATA })`.
 */
import { getAptosClient } from "./aptos";

export { getAptosClient };
export async function getAptBalance(address: string): Promise<number> {
  try {
    const aptos = getAptosClient();
    const resource = await aptos.getAccountAPTAmount({ accountAddress: address });
    return Number(resource) / 1e8;
  } catch {
    return 0;
  }
}

export function getShelbyUsdBalance(address: string): number {
  return readLedger(address);
}

const SHELBYUSD_LEDGER = "shelby-sudoku-shelbyusd-ledger";

export interface Balances {
  apt: number; // octas → APT
  shelbyUSD: number;
}

function readLedger(address: string): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(`${SHELBYUSD_LEDGER}:${address.toLowerCase()}`);
  return raw ? Number(raw) || 0 : 0;
}

function writeLedger(address: string, value: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${SHELBYUSD_LEDGER}:${address.toLowerCase()}`, String(value));
}

export async function loadBalances(address: string | undefined): Promise<Balances> {
  if (!address) return { apt: 0, shelbyUSD: 0 };
  let apt = 0;
  try {
    const aptos = getAptosClient();
    const resource = await aptos.getAccountAPTAmount({ accountAddress: address });
    apt = Number(resource) / 1e8;
  } catch {
    apt = 0;
  }
  return { apt, shelbyUSD: readLedger(address) };
}

export function creditShelbyUSD(address: string, amount: number): number {
  const next = Math.max(0, readLedger(address) + amount);
  writeLedger(address, next);
  return next;
}

export function debitShelbyUSD(address: string, amount: number): number {
  const next = Math.max(0, readLedger(address) - amount);
  writeLedger(address, next);
  return next;
}

export function recordRun(address: string, level: number, ms: number, hintsUsed?: number, source?: string): void {
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