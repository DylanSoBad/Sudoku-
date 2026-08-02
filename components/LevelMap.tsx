"use client";

import Link from "next/link";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useMemo } from "react";
import { levelsForUI } from "@/lib/levels";
import { loadProgress } from "@/lib/progress";
import { cn } from "@/lib/utils";
import { MAX_LEVEL } from "@/lib/tokenomics";

const DIFF_COLOR: Record<string, string> = {
  easy: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  medium: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  hard: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  expert: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  master: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export function LevelMap() {
  const { account } = useWallet();
  const cleared = useMemo(
    () => (account?.address ? loadProgress(account.address) : []),
    [account?.address],
  );
  const levels = useMemo(
    () => levelsForUI(account?.address, cleared),
    [account?.address, cleared],
  );

  return (
    <section aria-labelledby="level-map-title">
      <h2 id="level-map-title" className="mb-3 text-sm font-semibold uppercase tracking-wider text-shelby-muted">
        Level map
      </h2>
      <p className="mb-4 text-sm text-shelby-muted">
        Unlock levels by solving. Progress is signed locally.
      </p>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-10">
        {levels.map(({ n, difficulty, unlocked }) => (
          <Link
            key={n}
            href={unlocked ? `/play/${n}` : "#"}
            aria-disabled={!unlocked}
            className={cn(
              "group relative flex h-20 flex-col items-center justify-center rounded-xl border text-center transition-all",
              unlocked
                ? "border-shelby-border bg-shelby-surface hover:border-shelby-accent hover:shadow-glow"
                : "border-shelby-border/40 bg-shelby-surface/40 text-shelby-muted",
            )}
          >
            <span className="text-lg font-semibold">{n}</span>
            <span
              className={cn(
                "mt-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                DIFF_COLOR[difficulty] ?? "border-shelby-border",
              )}
            >
              {difficulty}
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-xs text-shelby-muted">Levels 1–{MAX_LEVEL}</p>
    </section>
  );
}