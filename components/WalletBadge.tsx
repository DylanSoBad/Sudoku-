"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { loadBalances, type Balances } from "@/lib/balances";
import { Button } from "@/components/ui/button";

function short(addr?: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function WalletBadge() {
  const { account, connect, disconnect } = useWallet();
  const [balances, setBalances] = useState<Balances>({ apt: 0, shelbyUSD: 0 });

  useEffect(() => {
    if (!account?.address) return;
    loadBalances(account.address).then(setBalances).catch(() => undefined);
  }, [account?.address]);

  const copyAddress = useCallback(() => {
    const addr = account?.address;
    if (!addr) return;
    void navigator.clipboard
      .writeText(addr)
      .then(() => toast("Address copied"))
      .catch(() => toast("Copy failed"));
  }, [account?.address]);

  if (!account) {
    return (
      <Button
        size="sm"
        variant="primary"
        onClick={() => connect("Petra" as unknown as Parameters<typeof connect>[0])}
      >
        Connect wallet
      </Button>
    );
  }

  return (
    <div className="flex items-center divide-x divide-line rounded-md border border-line bg-surface-2 text-xs">
      <button
        type="button"
        onClick={copyAddress}
        title="Copy address"
        className="px-2.5 py-1.5 font-mono text-content transition-colors duration-100 hover:text-accent-hover"
      >
        {short(account.address)}
      </button>
      <span className="px-2.5 py-1.5 font-mono text-content-muted">
        {balances.apt.toFixed(2)} APT
      </span>
      <span className="hidden px-2.5 py-1.5 font-mono text-content-muted sm:inline">
        {balances.shelbyUSD.toFixed(3)} sUSD
      </span>
      <button
        type="button"
        onClick={() => disconnect()}
        title="Disconnect"
        className="px-2.5 py-1.5 text-content-subtle transition-colors duration-100 hover:text-danger"
      >
        Disconnect
      </button>
    </div>
  );
}
