"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet, type InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { Lightbulb, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { waitForTxSuccess, registryAddress } from "@/lib/aptos";
import { pickHintCell, type Board } from "@/lib/sudoku";
import { consumeFreeHint, effectiveStreak, getHintPricing } from "@/lib/streak";
import {
  HINT_COST_LABEL,
  HINT_COST_SUSD,
  MAX_HINTS_PER_LEVEL,
} from "@/lib/tokenomics";
import {
  bumpLocalHintsUsed,
  fetchOnChainHintsUsed,
  getLocalHintsUsed,
  hintLimitReached,
} from "@/lib/hints";
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

interface BuyHintResult {
  txHash: string;
  appliedHint: { index: number; value: number };
}

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
  const { account, connected, signAndSubmitTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<HintKind>("cell");
  const [streak, setStreak] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);

  useEffect(() => {
    setStreak(effectiveStreak());
    const onStreak = () => setStreak(effectiveStreak());
    window.addEventListener("shelby:streak", onStreak);
    return () => window.removeEventListener("shelby:streak", onStreak);
  }, []);

  // Pricing is flat on-chain, so the only remaining modifier is the streak's
  // free hint, which skips the transaction entirely.
  const freeHintAvailable = useMemo(
    () => getHintPricing(HINT_COST_SUSD).freeHintAvailable,
    // `streak` is not read directly but a change to it can flip availability.
    [streak],
  );

  const refreshHints = useCallback(async () => {
    const addr = account?.address;
    if (!addr) {
      setHintsUsed(0);
      return;
    }
    const registry = registryAddress();
    if (registry) {
      const onChain = await fetchOnChainHintsUsed(registry, addr, level);
      if (onChain !== null) {
        setHintsUsed(onChain);
        return;
      }
    }
    setHintsUsed(getLocalHintsUsed(addr, level));
  }, [account?.address, level]);

  useEffect(() => {
    void refreshHints();
  }, [refreshHints]);

  const atLimit = hintLimitReached(hintsUsed);

  async function buyHintOnChain(): Promise<BuyHintResult | null> {
    if (!connected) {
      toast.error(t.hintShop.connectWallet);
      return null;
    }
    const registry = registryAddress();
    if (!registry) {
      toast.error("NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS is not set");
      return null;
    }
    const idx = pickHintCell(current, solution);
    if (idx < 0) {
      toast.message("No empty cells left for a hint");
      return null;
    }

    const payload: InputTransactionData = {
      data: {
        function: `${registry}::hint_shop::buy_hint`,
        typeArguments: [],
        functionArguments: [level],
      },
    };

    const pending = await signAndSubmitTransaction(payload);
    await waitForTxSuccess(pending.hash);
    window.dispatchEvent(new CustomEvent("shelby:balances"));
    return {
      txHash: pending.hash,
      appliedHint: { index: idx, value: solution[idx]! },
    };
  }

  async function buyHintLocal() {
    const idx = pickHintCell(current, solution);
    if (idx < 0) {
      toast.message("No empty cells left for a hint");
      return;
    }
    onHint(idx, solution[idx]!);
  }

  async function buyHint() {
    if (!connected) {
      toast.error(t.hintShop.connectWallet);
      return;
    }
    if (atLimit) {
      toast.error(`Max ${MAX_HINTS_PER_LEVEL} hints per level`);
      return;
    }

    setLoading(true);
    try {
      const useFree = freeHintAvailable;

      if (useFree) {
        consumeFreeHint();
        toast.success("Free streak hint used");
        if (kind === "cell") {
          await buyHintLocal();
        } else if (kind === "rowcol") {
          onRevealRowCol?.();
        } else {
          onFlashConflicts?.();
          toast.message("Conflicts highlighted (2.5s)");
        }
        if (account?.address) {
          setHintsUsed(bumpLocalHintsUsed(account.address, level));
        }
        return;
      }

      // On-chain buy_hint
      if (kind === "cell") {
        const result = await buyHintOnChain();
        if (result) {
          onHint(result.appliedHint.index, result.appliedHint.value);
          const explorerLink = `https://explorer.aptoslabs.com/txn/${result.txHash}?network=testnet`;
          toast.success("Hint purchased on-chain", {
            description: result.txHash,
            action: {
              label: "View",
              onClick: () => window.open(explorerLink, "_blank", "noopener"),
            },
          });
        }
      } else {
        // rowcol / conflicts still need on-chain buy_hint for the same level.
        const result = await buyHintOnChain();
        if (result) {
          if (kind === "rowcol") {
            onRevealRowCol?.();
          } else {
            onFlashConflicts?.();
            toast.message("Conflicts highlighted (2.5s)");
          }
          const explorerLink = `https://explorer.aptoslabs.com/txn/${result.txHash}?network=testnet`;
          toast.success("Hint purchased on-chain", {
            description: result.txHash,
            action: {
              label: "View",
              onClick: () => window.open(explorerLink, "_blank", "noopener"),
            },
          });
        }
      }
      await refreshHints();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Hint purchase failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const priceLabel = freeHintAvailable ? "FREE" : HINT_COST_LABEL;

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
        disabled={loading || atLimit}
        aria-label={`Buy ${kind} hint for ${priceLabel}`}
        title={t.hintShop.feeSplitTip}
      >
        {loading ? (
          <Loader2 className="h-4 w-4" />
        ) : (
          <Lightbulb className="h-4 w-4" />
        )}
        Buy Hint ({priceLabel})
      </Button>
      <p className="text-center text-xs text-shelby-muted">
        Hints used: {hintsUsed} / {MAX_HINTS_PER_LEVEL}
      </p>
      <div className="w-full max-w-xs" title={t.hintShop.feeSplitTip}>
        <RevenueSplitBar compact />
      </div>
    </div>
  );
}
