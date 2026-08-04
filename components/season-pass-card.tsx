"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Ticket, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getSeasonPass,
  isSeasonPassActive,
  purchaseSeasonPassLocal,
  type SeasonPassState,
} from "@/lib/season-pass";
import { SEASON_PASS } from "@/lib/tokenomics";
import { buildPurchaseSeasonPassPayload } from "@/lib/contracts";
import { registryAddress, toRawShelbyUsd, waitForTxSuccess } from "@/lib/aptos";
import { explorerTxUrl } from "@/lib/utils";
import { useT } from "@/components/app-providers";

export function SeasonPassCard() {
  const t = useT();
  const { connected, signAndSubmitTransaction } = useWallet();
  const [pass, setPass] = useState<SeasonPassState | null>(null);
  const [loading, setLoading] = useState(false);
  const registry = registryAddress();

  useEffect(() => {
    const refresh = () => setPass(getSeasonPass());
    refresh();
    window.addEventListener("shelby:season-pass", refresh);
    return () => window.removeEventListener("shelby:season-pass", refresh);
  }, []);

  const active = isSeasonPassActive();

  const buy = async () => {
    if (!connected) {
      toast.error(t.faucet.connectFirst);
      return;
    }
    setLoading(true);
    try {
      if (!registry) {
        // Offline only when registry is unset.
        const next = purchaseSeasonPassLocal(undefined, "local");
        setPass(next);
        toast.message(t.seasonPass.localPurchase);
        return;
      }
      if (!signAndSubmitTransaction) {
        toast.error("Wallet cannot sign transactions");
        return;
      }
      const payload = buildPurchaseSeasonPassPayload({
        priceMicro: toRawShelbyUsd(SEASON_PASS.priceShelbyUsd),
      });
      const pending = await signAndSubmitTransaction(payload);
      await waitForTxSuccess(pending.hash);
      const next = purchaseSeasonPassLocal(pending.hash, "chain");
      setPass(next);
      toast.success("Season Pass purchased", {
        description: explorerTxUrl(pending.hash),
      });
      window.dispatchEvent(new CustomEvent("shelby:balances"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card data-tour="season-pass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-shelby-accent2" />
          {t.seasonPass.title}
          {active ? <Badge variant="accent">Active</Badge> : null}
        </CardTitle>
        <CardDescription>{t.seasonPass.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-shelby-muted">{t.seasonPass.benefits}</p>
        {active && pass ? (
          <p className="text-sm text-shelby-gold">
            {t.seasonPass.activeUntil}{" "}
            <span className="font-mono">
              {new Date(pass.expiresAt).toLocaleDateString()}
            </span>
          </p>
        ) : (
          <Button onClick={() => void buy()} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4" /> : null}
            {t.seasonPass.buy} ({SEASON_PASS.priceShelbyUsd} sUSD)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
