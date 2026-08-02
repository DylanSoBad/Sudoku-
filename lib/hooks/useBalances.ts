"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { getAptosClient } from "@/lib/aptos";

export interface Balances {
  apt: number;
  shelbyUSD: number;
}

const SHELBYUSD_LEDGER = "shelby-sudoku-shelbyusd";

function readLedger(address: string): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(`${SHELBYUSD_LEDGER}:${address.toLowerCase()}`);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function writeLedger(address: string, value: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `${SHELBYUSD_LEDGER}:${address.toLowerCase()}`,
    String(Math.max(0, value)),
  );
}

export function creditShelbyUSD(address: string, amount: number): number {
  const next = readLedger(address) + amount;
  writeLedger(address, next);
  return next;
}

export function debitShelbyUSD(address: string, amount: number): number {
  const next = Math.max(0, readLedger(address) - amount);
  writeLedger(address, next);
  return next;
}

export function getShelbyUSD(address: string): number {
  return readLedger(address);
}

export async function getAptBalance(address: string): Promise<number> {
  const client = getAptosClient();
  const amount = await client.getAccountAPTAmount({ accountAddress: address });
  return Number(amount) / 1e8;
}

export async function getShelbyUsdBalance(address: string): Promise<number> {
  return readLedger(address);
}

export async function loadBalances(address: string): Promise<Balances> {
  try {
    const apt = await getAptBalance(address);
    return { apt, shelbyUSD: readLedger(address) };
  } catch {
    return { apt: 0, shelbyUSD: readLedger(address) };
  }
}

export function useBalances(): { balances: Balances; refresh: () => Promise<void>; busy: boolean } {
  const { account } = useWallet();
  const [balances, setBalances] = useState<Balances>({ apt: 0, shelbyUSD: 0 });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!account?.address) {
      setBalances({ apt: 0, shelbyUSD: 0 });
      return;
    }
    setBusy(true);
    try {
      const b = await loadBalances(account.address);
      setBalances(b);
    } finally {
      setBusy(false);
    }
  }, [account?.address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balances, refresh, busy };
}

export function recordRead(level: number, source: "shelby" | "cache" | "generated"): void {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem("shelby-sudoku-read-count");
  const next = (Number(raw) || 0) + 1;
  window.localStorage.setItem("shelby-sudoku-read-count", String(next));
  const logRaw = window.localStorage.getItem("shelby-sudoku-read-log");
  const log = logRaw ? (JSON.parse(logRaw) as Array<{ ts: number; level: number; source: string }>) : [];
  log.push({ ts: Date.now(), level, source });
  if (log.length > 200) log.splice(0, log.length - 200);
  window.localStorage.setItem("shelby-sudoku-read-log", JSON.stringify(log));
}
