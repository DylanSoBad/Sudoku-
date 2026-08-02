"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useEffect, useState } from "react";
import { loadBalances, type Balances } from "@/lib/balances";
import { Button } from "@/components/ui/button";

function short(addr?: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletBadge() {
  const { account, connect, disconnect, wallets } = useWallet();
  const [balances, setBalances] = useState<Balances>({ apt: 0, shelbyUSD: 0 });

  useEffect(() => {
    if (!account?.address) return;
    loadBalances(account.address).then(setBalances).catch(() => undefined);
  }, [account?.address]);

  if (!account) {
    return (
      <Button
        size="sm"
        variant="primary"
        onClick={() => connect("Petra" as unknown as Parameters<typeof connect>[0])}
      >
        Connect
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-shelby-border bg-shelby-surface px-3 py-1.5 text-sm">
      <span className="font-mono text-shelby-fg-strong">{short(account.address)}</span>
      <span className="rounded bg-shelby-bg px-2 py-0.5 text-xs">
        {balances.apt.toFixed(2)} APT
      </span>
      <span className="rounded bg-shelby-bg px-2 py-0.5 text-xs">
        {balances.shelbyUSD.toFixed(2)} sUSD
      </span>
      <button
        onClick={() => disconnect()}
        className="text-xs text-shelby-muted hover:text-shelby-danger"
      >
        disconnect
      </button>
    </div>
  );
}