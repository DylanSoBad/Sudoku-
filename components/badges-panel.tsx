"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Award } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BADGE_MILESTONES,
  getEarnedBadges,
  type EarnedBadge,
} from "@/lib/badges";
import { useT } from "@/components/app-providers";

export function BadgesPanel() {
  const t = useT();
  const { account, connected } = useWallet();
  const [earned, setEarned] = useState<EarnedBadge[]>([]);

  useEffect(() => {
    const addr = connected && account ? account.address.toString() : "guest";
    const refresh = () => setEarned(getEarnedBadges(addr));
    refresh();
    window.addEventListener("shelby:badges", refresh);
    window.addEventListener("shelby:progress", refresh);
    return () => {
      window.removeEventListener("shelby:badges", refresh);
      window.removeEventListener("shelby:progress", refresh);
    };
  }, [connected, account]);

  const earnedIds = new Set(earned.map((e) => e.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-shelby-gold" />
          {t.badges.title}
        </CardTitle>
        <CardDescription>{t.badges.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {BADGE_MILESTONES.length === 0 ? (
          <p className="text-sm text-shelby-muted">{t.badges.empty}</p>
        ) : (
          <ul className="space-y-3">
            {BADGE_MILESTONES.map((def) => {
              const got = earnedIds.has(def.id);
              const rec = earned.find((e) => e.id === def.id);
              return (
                <li
                  key={def.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-shelby-border/80 px-3 py-2"
                >
                  <div>
                    <p className={`text-sm font-medium ${got ? "text-white" : "text-shelby-muted"}`}>
                      {def.name}
                    </p>
                    <p className="text-xs text-shelby-muted">{def.description}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-shelby-muted/80">
                      {def.metadataBlobHint}
                      {rec?.blobName ? ` · ${rec.blobName}` : ""}
                    </p>
                  </div>
                  {got ? (
                    <Badge variant="gold">{t.badges.earned}</Badge>
                  ) : (
                    <Badge variant="muted">L{def.level}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
