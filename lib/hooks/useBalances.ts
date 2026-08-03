"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { toast } from "sonner";
import { getAptBalance, getShelbyUsdBalance } from "@/lib/aptos";

export interface Balances {
  apt: number;
  shelbyUSD: number;
}

const POLL_MS_VISIBLE = 8_000;

function shorten(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 120);
  if (typeof err === "string") return err.slice(0, 120);
  return "Balance refresh failed";
}

/**
 * Polls APT and shelbyUSD balances for the connected wallet.
 *
 * - Refetches every 8 s while the tab is visible; pauses on `visibilitychange`.
 * - Refetches on `accountChanged` (wallet-adapter emits via internal events)
 *   and on the app-level `shelby:balances` event used after faucet/submit tx.
 * - Emits a toast.error on failure but never throws — UI stays usable.
 */
export function useBalances(): {
  apt: number;
  susd: number;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { account } = useWallet();
  const [apt, setApt] = useState(0);
  const [susd, setSusd] = useState(0);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!account?.address) {
      setApt(0);
      setSusd(0);
      return;
    }
    setLoading(true);
    const addr = account.address.toString();
    try {
      const [a, s] = await Promise.all([
        getAptBalance(addr),
        getShelbyUsdBalance(addr),
      ]);
      if (cancelledRef.current) return;
      setApt(a);
      setSusd(s);
    } catch (err) {
      if (!cancelledRef.current) {
        toast.error(shorten(err) || "Balance refresh failed");
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [account?.address]);

  // Re-fetch on address change + while page is visible.
  useEffect(() => {
    cancelledRef.current = false;
    void refresh();

    const startPoll = () => {
      stopPoll();
      timerRef.current = window.setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        void refresh();
      }, POLL_MS_VISIBLE);
    };
    const stopPoll = () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) stopPoll();
      else {
        void refresh();
        startPoll();
      }
    };
    const onBalancesEvent = () => void refresh();

    if (account?.address) startPoll();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("shelby:balances", onBalancesEvent);

    return () => {
      cancelledRef.current = true;
      stopPoll();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("shelby:balances", onBalancesEvent);
    };
  }, [refresh, account?.address]);

  return { apt, susd, loading, refresh };
}

export type UseBalances = ReturnType<typeof useBalances>;
