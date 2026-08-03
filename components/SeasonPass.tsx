"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { loadPrefs, savePrefs } from "@/lib/preferences";
import { SEASON_PASS } from "@/lib/tokenomics";

export function SeasonPass() {
  const { account } = useWallet();
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = loadPrefs();
    setActive(p.seasonPass);
  }, []);

  function buy() {
    if (!account?.address) {
      setError("Connect a wallet first");
      return;
    }
    const next = loadPrefs();
    if (next.seasonPass) {
      setError("Already active");
      return;
    }
    // Season pass is purchased on-chain via season_pass::purchase when the
    // Move registry is configured. Until then we just flip the local flag
    // (still useful for offline testing) without mutating balances.
    window.dispatchEvent(new CustomEvent("shelby:balances"));
    savePrefs({
      ...next,
      seasonPass: true,
      seasonExpiresAt: Date.now() + SEASON_PASS.durationDays * 86400000,
    });
    setActive(true);
    setError(null);
  }

  return (
    <section aria-labelledby="season-title">
      <h2 id="season-title" className="mb-3 text-sm font-semibold uppercase tracking-wider text-shelby-muted">
        Season Pass
      </h2>
      <p className="mb-3 text-xs text-shelby-muted">
        {SEASON_PASS.price} shelbyUSD / {SEASON_PASS.durationDays} days — half-price hints + board skin
      </p>
      <div className="rounded-lg border border-shelby-border bg-shelby-surface p-3 text-sm">
        <div className="flex items-center justify-between">
          <span>Hint ×2 pricing · Season board skin</span>
          <Button size="sm" variant={active ? "secondary" : "primary"} onClick={buy}>
            {active ? "Active" : `Buy pass (${SEASON_PASS.price} sUSD)`}
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-shelby-danger">{error}</p>}
      </div>
    </section>
  );
}