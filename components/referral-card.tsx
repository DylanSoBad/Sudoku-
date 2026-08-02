"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Gift, Copy } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  applyReferralCode,
  claimPendingReferrerCredit,
  ensureInviteCode,
  getLocalCredit,
  hasAppliedReferral,
} from "@/lib/referral";
import { buildReferralRegisterPayload } from "@/lib/contracts";
import { useT } from "@/components/app-providers";

export function ReferralCard() {
  const t = useT();
  const { account, connected, signAndSubmitTransaction } = useWallet();
  const [code, setCode] = useState("");
  const [input, setInput] = useState("");
  const [credit, setCredit] = useState(0);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setCredit(getLocalCredit());
      setApplied(hasAppliedReferral());
    };
    refresh();
    if (connected && account) {
      const c = ensureInviteCode(account.address.toString());
      setCode(c);
      const bonus = claimPendingReferrerCredit(account.address.toString());
      if (bonus > 0) {
        toast.success(`+${bonus} shelbyUSD ${t.referral.localBonus}`);
      }
    } else {
      setCode("");
    }
    window.addEventListener("shelby:credits", refresh);
    return () => window.removeEventListener("shelby:credits", refresh);
  }, [connected, account, t.referral.localBonus]);

  const onApply = async () => {
    const addr = account?.address?.toString() ?? null;
    const result = applyReferralCode(input, addr);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setApplied(true);
    setCredit(getLocalCredit());
    toast.success(result.message, { description: t.referral.localBonus });

    if (connected && signAndSubmitTransaction) {
      try {
        const payload = buildReferralRegisterPayload({ code: input.trim().toUpperCase() });
        await signAndSubmitTransaction(payload);
        toast.success("Referral registered on-chain");
      } catch (err) {
        console.warn("[shelby:fallback] referral on-chain skipped", err);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-shelby-accent" />
          {t.referral.title}
        </CardTitle>
        <CardDescription>{t.referral.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {code ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-shelby-border px-3 py-2">
            <div>
              <p className="text-xs text-shelby-muted">{t.referral.yourCode}</p>
              <p className="font-mono text-lg text-white">{code}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(code);
                toast.success("Copied");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              {t.referral.copy}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-shelby-muted">{t.faucet.connectFirst}</p>
        )}

        <p className="text-xs text-shelby-muted">
          {t.referral.localBonus}:{" "}
          <span className="font-mono text-shelby-gold">{credit.toFixed(2)} sUSD</span>
        </p>

        {!applied ? (
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.referral.enterCode}
              className="h-10 flex-1 rounded-lg border border-shelby-border bg-shelby-bg px-3 text-sm text-white placeholder:text-shelby-muted"
              aria-label={t.referral.enterCode}
            />
            <Button size="sm" className="h-10" onClick={() => void onApply()}>
              {t.referral.apply}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-shelby-accent">{t.referral.applied}</p>
        )}
      </CardContent>
    </Card>
  );
}
