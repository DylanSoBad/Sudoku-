"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Lightbulb, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildBuyHintPayload } from "@/lib/contracts";
import { getAptosClient } from "@/lib/balances";
import { getLevelMeta, pickHintCell, type Board } from "@/lib/sudoku";
import {
  consumeFreeHint,
  effectiveStreak,
  getHintPricing,
} from "@/lib/streak";
import { seasonPassHintMultiplier } from "@/lib/season-pass";
import { RevenueSplitBar } from "@/components/revenue-split";
import { useT } from "@/components/app-providers";

export type HintKind = "cell" | "rowcol" | "conflicts";

export interface HintShopProps {
  level: number;
  sessionId: string;
  current: Board;
  solution: Board;
  onHint: (index: number, value: number) => void;
  onRevealRowCol?: () => void;
  onFlashConflicts?: () => void;
}

const CONFLICT_PRICE = 0.02;

export function HintShop({
  level,
  sessionId,
  current,
  solution,
  onHint,
  onRevealRowCol,
  onFlashConflicts,
}: HintShopProps) {
  const t = useT();
  const { connected, signAndSubmitTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<HintKind>("cell");
  const [streak, setStreak] = useState(0);
  const [passMult, setPassMult] = useState(1);
  const meta = getLevelMeta(level);

  useEffect(() => {
    setStreak(effectiveStreak());
    setPassMult(seasonPassHintMultiplier());
    const onStreak = () => setStreak(effectiveStreak());
    const onPass = () => setPassMult(seasonPassHintMultiplier());
    window.addEventListener("shelby:streak", onStreak);
    window.addEventListener("shelby:season-pass", onPass);
    return () => {
      window.removeEventListener("shelby:streak", onStreak);
      window.removeEventListener("shelby:season-pass", onPass);
    };
  }, []);

  const pricing = useMemo(() => {
    const basePrice = meta.hintPrice ?? meta.hintCost ?? 0;
    if (kind === "conflicts") {
      const free = getHintPricing(basePrice).freeHintAvailable;
      const price = free ? 0 : CONFLICT_PRICE * passMult;
      return {
        price,
        priceMicro: free ? 0 : Math.round(price * 1_000_000),
        freeHintAvailable: free,
        discount: 1,
      };
    }
    const base = kind === "rowcol" ? basePrice * 2 : basePrice;
    const priced = getHintPricing(base);
    const price = priced.freeHintAvailable ? 0 : priced.price * passMult;
    return {
      ...priced,
      price,
      priceMicro: priced.freeHintAvailable ? 0 : Math.round(price * 1_000_000),
    };
  }, [kind, meta.hintPrice, meta.hintCost, passMult]);

  const buyHint = async () => {
    if (!connected) {
      toast.error(t.hintShop.connectWallet);
      return;
    }

    if (kind === "cell") {
      const idx = pickHintCell(current, solution);
      if (idx < 0) {
        toast.message("No empty cells left for a hint");
        return;
      }
    }

    setLoading(true);
    try {
      const useFree = pricing.freeHintAvailable;
      let skipChain = useFree || pricing.priceMicro === 0;

      if (!skipChain) {
        let payload;
        try {
          payload = buildBuyHintPayload({
            level,
            sessionId,
            priceShelbyUSDMicro: pricing.priceMicro,
          });
        } catch (err) {
          console.warn("[shelby:fallback] hint contract unavailable", err);
          skipChain = true;
        }

        if (!skipChain && payload) {
          const pending = await signAndSubmitTransaction(payload);
          const aptos = getAptosClient();
          await aptos.waitForTransaction({ transactionHash: pending.hash });
          toast.success("Hint purchased on-chain");
          window.dispatchEvent(new CustomEvent("shelby:balances"));
        } else if (skipChain && !useFree) {
          toast.message("Local hint (deploy Move package for on-chain buy)", {
            description: "NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS is empty",
          });
        }
      } else if (useFree) {
        consumeFreeHint();
        toast.success("Free streak hint used");
      }

      if (kind === "cell") {
        const idx = pickHintCell(current, solution);
        if (idx < 0) {
          toast.message("No empty cells left for a hint");
          return;
        }
        onHint(idx, solution[idx]!);
      } else if (kind === "rowcol") {
        onRevealRowCol?.();
      } else {
        onFlashConflicts?.();
        toast.message("Conflicts highlighted (2.5s)");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Hint purchase failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const priceLabel =
    pricing.price === 0 ? "FREE" : `${pricing.price} shelbyUSD`;

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      {streak >= 3 ? (
        <p className="text-center text-xs text-shelby-gold">
          Streak {streak}d
          {streak >= 3 ? " · 30% hint discount" : ""}
          {streak >= 5 ? " · 1 free hint/day" : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-center gap-2">
        {(
          [
            ["cell", t.hintShop.revealCell],
            ["rowcol", t.hintShop.revealRowCol],
            ["conflicts", t.hintShop.highlightConflicts],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={
              kind === k
                ? "rounded-md border border-shelby-accent bg-shelby-accent/10 px-3 py-1.5 text-xs text-shelby-accent"
                : "rounded-md border border-shelby-border bg-shelby-panel px-3 py-1.5 text-xs text-shelby-muted hover:border-shelby-accent/50"
            }
            aria-pressed={kind === k}
          >
            {label}
          </button>
        ))}
      </div>

      <Button
        variant="primary"
        onClick={() => void buyHint()}
        disabled={loading}
        aria-label={`Buy ${kind} hint for ${priceLabel}`}
        title={t.hintShop.feeSplitTip}
      >
        {loading ? (
          <Loader2 className="h-4 w-4" />
        ) : (
          <Lightbulb className="h-4 w-4" />
        )}
        {t.hintShop.buyHint} ({priceLabel})
      </Button>
      <div className="w-full max-w-xs" title={t.hintShop.feeSplitTip}>
        <RevenueSplitBar compact />
      </div>
    </div>
  );
}
