"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import { HINT_COST_SUSD } from "@/lib/tokenomics";
import { toast } from "sonner";
import { loadBalances, type Balances } from "@/lib/balances";
import { Button } from "@/components/ui/button";
import { WalletPicker } from "@/components/WalletPicker";

function short(addr?: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Show enough decimals that a single hint purchase is visible. At 3 decimals a
 * 0.0005 sUSD charge rounds away and the balance looks unchanged.
 */
const SUSD_DECIMALS = (() => {
  const text = HINT_COST_SUSD.toString();
  const dot = text.indexOf(".");
  return dot < 0 ? 2 : Math.min(8, text.length - dot - 1);
})();

export function WalletBadge() {
  const { account, disconnect } = useWallet();
  const [balances, setBalances] = useState<Balances>({ apt: 0, shelbyUSD: 0 });
  const [pickerOpen, setPickerOpen] = useState(false);

  // AccountAddress is an object, so keep a string for effect deps and callers.
  const address = account?.address?.toString();

  const refresh = useCallback(() => {
    if (!address) return;
    loadBalances(address).then(setBalances).catch(() => undefined);
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Every on-chain action (hint, claim, faucet, season pass) fires this event.
  // Without it the header keeps showing the pre-transaction balance, which
  // reads as "the hint did not cost anything".
  useEffect(() => {
    if (!address) return;
    const onTx = () => refresh();
    window.addEventListener("shelby:balances", onTx);
    return () => window.removeEventListener("shelby:balances", onTx);
  }, [address, refresh]);

  const copyAddress = useCallback(() => {
    if (!address) return;
    void navigator.clipboard
      .writeText(address)
      .then(() => toast("Address copied"))
      .catch(() => toast("Copy failed"));
  }, [address]);

  if (!account) {
    return (
      <>
        <Button
          data-tour="wallet"
          size="sm"
          variant="primary"
          onClick={() => setPickerOpen(true)}
        >
          Connect wallet
        </Button>
        <WalletPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      </>
    );
  }

  return (
    <div
      data-tour="wallet"
      className="flex items-center divide-x divide-line rounded-md border border-line bg-surface-2 text-xs"
    >
      <button
        type="button"
        onClick={copyAddress}
        title="Copy address"
        className="px-2.5 py-1.5 font-mono text-content transition-colors duration-100 hover:text-accent-hover"
      >
        {short(address)}
      </button>
      <span className="px-2.5 py-1.5 font-mono text-content-muted">
        {balances.apt.toFixed(2)} APT
      </span>
      <span className="hidden px-2.5 py-1.5 font-mono text-content-muted sm:inline">
        {balances.shelbyUSD.toFixed(SUSD_DECIMALS)} sUSD
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
