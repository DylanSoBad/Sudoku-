"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Gift, Copy } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  applyReferralCode,
  ensureInviteCode,
  getLocalCredit,
  hasAppliedReferral,
} from "@/lib/referral";
import {
  buildPublishCodePayload,
  buildReferralRegisterPayload,
} from "@/lib/contracts";
import { registryAddress, waitForTxSuccess } from "@/lib/aptos";
import { REFERRAL_BONUS_SUSD } from "@/lib/tokenomics";
import { useT } from "@/components/app-providers";

export function ReferralCard() {
  const t = useT();
  const { account, connected, signAndSubmitTransaction } = useWallet();
  const [code, setCode] = useState("");
  const [input, setInput] = useState("");
  const [credit, setCredit] = useState(0);
  const [applied, setApplied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const registry = registryAddress();

  useEffect(() => {
    const refresh = () => {
      setCredit(getLocalCredit());
      setApplied(hasAppliedReferral());
    };
    refresh();
    if (connected && account) {
      const c = ensureInviteCode(account.address.toString());
      setCode(c);
      // Bind the invite code on-chain so referees can look it up.
      if (registry && signAndSubmitTransaction && !publishing) {
        setPublishing(true);
        void (async () => {
          try {
            const pending = await signAndSubmitTransaction(buildPublishCodePayload(c));
            await waitForTxSuccess(pending.hash);
          } catch (err) {
            // Already published is fine; other errors are non-fatal for the UI.
            console.warn("[referral:publish_code]", err);
          } finally {
            setPublishing(false);
          }
        })();
      }
    } else {
      setCode("");
    }
    window.addEventListener("shelby:credits", refresh);
    return () => window.removeEventListener("shelby:credits", refresh);
    // publishing intentionally omitted — one publish attempt per connect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, account, registry, signAndSubmitTransaction]);

  const onApply = async () => {
    const addr = account?.address?.toString() ?? null;
    const trimmed = input.trim().toUpperCase();

    if (registry && connected && signAndSubmitTransaction) {
      try {
        const payload = buildReferralRegisterPayload({ code: trimmed });
        const pending = await signAndSubmitTransaction(payload);
        await waitForTxSuccess(pending.hash);
        // Mark local applied so the form hides; on-chain is source of truth.
        applyReferralCode(trimmed, addr);
        setApplied(true);
        toast.success(`Referral registered · +${REFERRAL_BONUS_SUSD} sUSD each`);
        window.dispatchEvent(new CustomEvent("shelby:balances"));
        return;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Referral failed");
        return;
      }
    }

    // Offline fallback — local credit only.
    const result = applyReferralCode(input, addr);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setApplied(true);
    setCredit(getLocalCredit());
    toast.success(result.message, { description: t.referral.localBonus });
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

        {!registry && (
          <p className="text-xs text-shelby-muted">
            {t.referral.localBonus}:{" "}
            <span className="font-mono text-shelby-gold">{credit.toFixed(2)} sUSD</span>
          </p>
        )}

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
