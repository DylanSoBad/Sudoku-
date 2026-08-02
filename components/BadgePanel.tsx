"use client";

import { useEffect, useState } from "react";
import { loadProgress } from "@/lib/progress";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Button } from "@/components/ui/button";

interface Badge {
  id: string;
  label: string;
  description: string;
  level: number;
  assetPath: string;
}

const BADGES: Badge[] = [
  {
    id: "easy_clear",
    label: "Easy Clear",
    description: "Solve Level 3",
    level: 3,
    assetPath: "/badges/easy_clear.json",
  },
  {
    id: "hard_adept",
    label: "Hard Adept",
    description: "Solve Level 10",
    level: 10,
    assetPath: "/badges/hard_adept.json",
  },
  {
    id: "master",
    label: "Master",
    description: "Solve Level 20",
    level: 20,
    assetPath: "/badges/master.json",
  },
];

export function BadgePanel() {
  const { account } = useWallet();
  const cleared = account?.address ? loadProgress(account.address) : [];

  return (
    <section id="badges" aria-labelledby="badges-title">
      <h2 id="badges-title" className="mb-3 text-sm font-semibold uppercase tracking-wider text-shelby-muted">
        Badges
      </h2>
      <p className="mb-3 text-xs text-shelby-muted">
        Milestone NFTs (local until Move deploy)
      </p>
      <ul className="space-y-2">
        {BADGES.map((b) => {
          const earned = cleared.includes(b.level);
          return (
            <li
              key={b.id}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                earned
                  ? "border-shelby-accent/50 bg-shelby-accent/10"
                  : "border-shelby-border bg-shelby-surface"
              }`}
            >
              <div>
                <div className="font-medium">{b.label}</div>
                <div className="text-xs text-shelby-muted">{b.description}</div>
              </div>
              <span className="text-xs text-shelby-muted">{b.assetPath}</span>
              <span className="rounded bg-shelby-bg px-2 py-0.5 text-xs">L{b.level}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}