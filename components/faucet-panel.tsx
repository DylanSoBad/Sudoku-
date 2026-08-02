"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Droplets, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requestAptFaucet, requestShelbyUsdFaucet } from "@/lib/faucet";
import { getAptosClient, getAptBalance, getShelbyUsdBalance } from "@/lib/balances";
import { sleep } from "@/lib/utils";

function explorerUrl(hash: string): string {
  return `https://explorer.aptoslabs.com/txn/${hash}?network=testnet`;
}

export function FaucetPanel() {
  const { account, connected } = useWallet();
  const [apt, setApt] = useState(0);
  const [shelbyUsd, setShelbyUsd] = useState(0);
  const [loadingApt, setLoadingApt] = useState(false);
  const [loadingUsd, setLoadingUsd] = useState(false);
  const [lastAptTx, setLastAptTx] = useState<string | null>(null);
  const [lastUsdTx, setLastUsdTx] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!account?.address) return;
    const addr = account.address.toString();
    const [a, s] = await Promise.all([
      getAptBalance(addr),
      getShelbyUsdBalance(addr),
    ]);
    setApt(a);
    setShelbyUsd(s);
    window.dispatchEvent(new CustomEvent("shelby:balances"));
  }, [account?.address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onApt = async () => {
    if (!account?.address) {
      toast.error("Connect a wallet first");
      return;
    }
    setLoadingApt(true);
    try {
      const result = await requestAptFaucet(account.address.toString());
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      const hash = result.txHashes?.[0] ?? null;
      setLastAptTx(hash);
      await sleep(5000);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "APT faucet failed");
    } finally {
      setLoadingApt(false);
    }
  };

  const onUsd = async () => {
    if (!account?.address) {
      toast.error("Connect a wallet first");
      return;
    }
    setLoadingUsd(true);
    try {
      const result = await requestShelbyUsdFaucet(account.address.toString());
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      const hash = result.txHashes?.[0] ?? null;
      setLastUsdTx(hash);
      await sleep(5000);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "shelbyUSD faucet failed");
    } finally {
      setLoadingUsd(false);
    }
  };

  return (
    <Card data-tour="faucet">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-shelby-accent" />
          <CardTitle>Faucet</CardTitle>
        </div>
        <CardDescription>
          Request testnet APT and shelbyUSD for gas + hints. Real HTTP calls to configured faucet URLs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connected ? (
          <p className="text-sm text-shelby-muted">
            Connect Petra, Pontem, or Nightly to use the faucet.
          </p>
        ) : null}

        <div className="flex flex-col gap-3 rounded-lg border border-shelby-border bg-shelby-bg/50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white">APT</p>
            <p
              className="font-mono text-lg text-shelby-accent"
              title={connected ? undefined : "Connect wallet to view balance"}
            >
              {connected ? apt.toFixed(4) : "—"}
            </p>
            {lastAptTx ? (
              <a
                href={explorerUrl(lastAptTx)}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-shelby-muted hover:text-shelby-accent"
              >
                View tx <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
          <Button
            variant="secondary"
            onClick={() => void onApt()}
            disabled={!connected || loadingApt}
            aria-label="Request APT from faucet"
          >
            {loadingApt ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Request
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-shelby-border bg-shelby-bg/50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white">shelbyUSD</p>
            <p
              className="font-mono text-lg text-shelby-gold"
              title={connected ? undefined : "Connect wallet to view balance"}
            >
              {connected ? shelbyUsd.toFixed(2) : "—"}
            </p>
            {lastUsdTx ? (
              <a
                href={explorerUrl(lastUsdTx)}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-shelby-muted hover:text-shelby-accent"
              >
                View tx <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <Badge variant="muted" className="mt-1">
                network: shelbynet
              </Badge>
            )}
          </div>
          <Button
            variant="secondary"
            onClick={() => void onUsd()}
            disabled={!connected || loadingUsd}
            aria-label="Request shelbyUSD from faucet"
          >
            {loadingUsd ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Request
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
