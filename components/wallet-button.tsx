"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Wallet, LogOut, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { short } from "@/lib/utils";
import { getAptosClient, getAptBalance, getShelbyUsdBalance } from "@/lib/balances";
import { useT } from "@/components/app-providers";

export function WalletButton() {
  const t = useT();
  const { connect, disconnect, account, connected, wallets, wallet } = useWallet();
  const [open, setOpen] = useState(false);
  const [apt, setApt] = useState<number | null>(null);
  const [shelbyUsd, setShelbyUsd] = useState<number | null>(null);

  useEffect(() => {
    if (!connected || !account?.address) {
      setApt(null);
      setShelbyUsd(null);
      return;
    }
    let cancelled = false;
    const addr = account.address.toString();
    const aptos = getAptosClient();

    const refresh = async () => {
      try {
        const [a, s] = await Promise.all([
          getAptBalance(addr),
          getShelbyUsdBalance(addr),
        ]);
        if (!cancelled) {
          setApt(a);
          setShelbyUsd(s);
        }
      } catch (err) {
        console.warn("balance refresh failed", err);
      }
    };

    void refresh();
    const id = window.setInterval(refresh, 15_000);
    const onFaucet = () => void refresh();
    window.addEventListener("shelby:balances", onFaucet);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("shelby:balances", onFaucet);
    };
  }, [connected, account?.address]);

  if (connected && account) {
    return (
      <div className="flex flex-wrap items-center gap-2" data-tour="wallet">
        <Badge variant="accent" title="APT balance">
          {apt === null ? "…" : `${apt.toFixed(4)} APT`}
        </Badge>
        <Badge variant="gold" title="shelbyUSD balance">
          {shelbyUsd === null ? "…" : `${shelbyUsd.toFixed(2)} sUSD`}
        </Badge>
        <Badge variant="muted">{wallet?.name ?? "Wallet"}</Badge>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void disconnect()}
          aria-label="Disconnect wallet"
        >
          <span className="font-mono">{short(account.address.toString())}</span>
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div data-tour="wallet">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          aria-label="Connect wallet"
          aria-expanded={open}
        >
          <Wallet className="h-4 w-4" />
          {t.nav.connect}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 min-w-[220px] rounded-lg border border-shelby-border bg-shelby-panel p-2 shadow-xl">
          {(wallets ?? []).length === 0 ? (
            <div className="space-y-2 px-2 py-3 text-xs text-shelby-muted">
              <p>{t.wallet.noWallets}</p>
              <a
                href="https://petra.app/"
                target="_blank"
                rel="noreferrer"
                className="block text-shelby-accent hover:underline"
              >
                {t.wallet.getPetra}
              </a>
              <a
                href="https://pontem.network/wallet"
                target="_blank"
                rel="noreferrer"
                className="block text-shelby-accent hover:underline"
              >
                Get Pontem →
              </a>
              <a
                href="https://nightly.app/download"
                target="_blank"
                rel="noreferrer"
                className="block text-shelby-accent hover:underline"
              >
                Get Nightly →
              </a>
            </div>
          ) : (
            (wallets ?? []).map((w) => (
              <button
                key={w.name}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-shelby-fg-strong transition-colors duration-150 hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => {
                  setOpen(false);
                  void connect(w.name);
                }}
              >
                {w.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.icon} alt="" className="h-5 w-5 rounded" />
                ) : (
                  <Wallet className="h-4 w-4 text-shelby-accent" />
                )}
                {w.name}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
