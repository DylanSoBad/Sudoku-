"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Wallet, ChevronDown, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBalances } from "@/lib/hooks/useBalances";
import { useT } from "@/components/app-providers";

function short(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function copy(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  }
}

export function ConnectButton() {
  const t = useT();
  const { account, connected, connect, disconnect, wallets, wallet } = useWallet();
  const { apt, susd, refresh } = useBalances();
  const [open, setOpen] = useState(false);

  // Refresh after any successful tx submission via the wallet-adapter.
  useEffect(() => {
    const onTx = () => void refresh();
    window.addEventListener("shelby:balances", onTx);
    return () => window.removeEventListener("shelby:balances", onTx);
  }, [refresh]);

  if (connected && account?.address) {
    const addr = account.address.toString();
    return (
      <div className="flex flex-wrap items-center gap-2" data-tour="connect">
        <Badge
          tabIndex={0}
          variant="accent"
          title="APT balance — click to copy address"
          onClick={async () => {
            await copy(addr);
            toast.success("Address copied");
          }}
          onKeyDown={async (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              await copy(addr);
              toast.success("Address copied");
            }
          }}
          role="button"
          aria-label={`Copy address ${short(addr)}`}
          className="cursor-pointer select-none"
        >
          {`${apt.toFixed(4)} APT`}
        </Badge>
        <Badge
          tabIndex={0}
          variant="gold"
          title="shelbyUSD balance — click to copy address"
          onClick={async () => {
            await copy(addr);
            toast.success("Address copied");
          }}
          onKeyDown={async (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              await copy(addr);
              toast.success("Address copied");
            }
          }}
          role="button"
          aria-label={`Copy address ${short(addr)}`}
          className="cursor-pointer select-none"
        >
          {`${susd.toFixed(2)} sUSD`}
        </Badge>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void disconnect()}
          aria-label="Disconnect wallet"
        >
          <span className="font-mono">{short(addr)}</span>
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div data-tour="connect">
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
        <div className="absolute right-0 z-40 mt-2 min-w-[220px] rounded-lg border border-shelby-border bg-shelby-panel p-2">
          {(wallets ?? []).length === 0 ? (
            <div className="space-y-2 px-2 py-3 text-xs text-shelby-muted">
              <p>{t.wallet.noWallets}</p>
              <a className="block text-shelby-accent hover:underline" href="https://petra.app/" target="_blank" rel="noreferrer">
                {t.wallet.getPetra}
              </a>
            </div>
          ) : (
            (wallets ?? []).map((w) => (
              <button
                key={w.name}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-shelby-fg-strong hover:bg-black/5 dark:hover:bg-white/5"
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
