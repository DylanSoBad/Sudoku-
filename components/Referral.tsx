"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { creditShelbyUSD, debitShelbyUSD } from "@/lib/balances";
import { REFERRAL_BONUS_SUSD } from "@/lib/tokenomics";

const KEY = "shelby-sudoku-referral";

function loadReferral(): { inviter: string; lastIssued: number } {
  if (typeof window === "undefined") return { inviter: "", lastIssued: 0 };
  const raw = localStorage.getItem(KEY);
  if (!raw) return { inviter: "", lastIssued: 0 };
  try { return JSON.parse(raw); } catch { return { inviter: "", lastIssued: 0 }; }
}

function saveReferral(v: { inviter: string; lastIssued: number }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(v));
}

export function Referral() {
  const { account } = useWallet();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [inviter, setInviter] = useState("");

  useEffect(() => {
    const ref = loadReferral();
    setInviter(ref.inviter);
  }, []);

  function apply() {
    if (!account?.address) {
      setStatus("Connect a wallet first");
      return;
    }
    const cleaned = code.trim().toLowerCase();
    if (!cleaned || cleaned === account.address.toLowerCase()) {
      setStatus("Invalid code");
      return;
    }
    if (inviter === cleaned) {
      setStatus("Already applied");
      return;
    }
    saveReferral({ inviter: cleaned, lastIssued: Date.now() });
    setInviter(cleaned);
    creditShelbyUSD(account.address, REFERRAL_BONUS_SUSD);
    creditShelbyUSD(cleaned, REFERRAL_BONUS_SUSD);
    setStatus(`+${REFERRAL_BONUS_SUSD} sUSD for both sides`);
    setCode("");
  }

  return (
    <section aria-labelledby="referral-title">
      <h2 id="referral-title" className="mb-3 text-sm font-semibold uppercase tracking-wider text-shelby-muted">
        Referral
      </h2>
      <p className="mb-3 text-xs text-shelby-muted">
        Invite friends — both get local shelbyUSD credit
      </p>
      <div className="space-y-2">
        <Input
          placeholder={account?.address ? "0x… inviter address" : "Connect a wallet first"}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={!account}
        />
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="primary" onClick={apply} disabled={!account}>
            Apply
          </Button>
          {status && <span className="text-xs text-shelby-accent2">{status}</span>}
        </div>
        {inviter && (
          <div className="text-xs text-shelby-muted">
            Local bonus credit: {REFERRAL_BONUS_SUSD.toFixed(2)} sUSD
          </div>
        )}
      </div>
    </section>
  );
}