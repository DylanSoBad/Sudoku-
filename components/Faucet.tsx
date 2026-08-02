"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { creditShelbyUSD } from "@/lib/balances";

interface FaucetPanelProps {
  kind: "apt" | "shelbyusd";
  label: string;
  endpoint: string;
}

export function FaucetPanel({ kind, label, endpoint }: FaucetPanelProps) {
  const { account, signAndSubmitTransaction } = useWallet();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function request() {
    if (!account?.address) return;
    setPending(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address: account.address,
          ...(kind === "shelbyusd" ? { network: "shelbynet" } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Faucet ${res.status}: ${await res.text()}`);
      const data = await res.json().catch(() => ({}));
      setDone(data?.txnHash ?? data?.hash ?? "ok");
      if (kind === "shelbyusd") creditShelbyUSD(account.address, 10);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-shelby-border bg-shelby-surface px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">{label}</span>
        {done && (
          <a
            className="text-xs text-shelby-accent2 underline"
            href={`https://explorer.aptoslabs.com/txn/${done}?network=testnet`}
            target="_blank"
            rel="noreferrer"
          >
            tx
          </a>
        )}
      </div>
      <Button size="sm" variant="primary" disabled={!account || pending} onClick={request}>
        {pending ? "…" : "Request"}
      </Button>
    </div>
  );
}

export function Faucet() {
  const apt = process.env.NEXT_PUBLIC_APTOS_FAUCET_URL ?? "https://faucet.testnet.aptoslabs.com/mint";
  const sUSD = process.env.NEXT_PUBLIC_SHELBYUSD_FAUCET_URL ?? "https://faucet.shelby.xyz/shelbyusd";

  return (
    <section aria-labelledby="faucet-title" className="space-y-3">
      <h2 id="faucet-title" className="text-sm font-semibold uppercase tracking-wider text-shelby-muted">
        Faucet
      </h2>
      <p className="text-xs text-shelby-muted">
        Real HTTP calls to configured faucet URLs.
      </p>
      <FaucetPanel kind="apt" label="APT" endpoint={apt} />
      <FaucetPanel kind="shelbyusd" label="shelbyUSD" endpoint={sUSD} />
    </section>
  );
}