"use client";

import Link from "next/link";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useMemo } from "react";
import { levelsForUI } from "@/lib/levels";
import { loadProgress } from "@/lib/progress";
import { cn } from "@/lib/utils";
import { MAX_LEVEL, economicsForLevel } from "@/lib/tokenomics";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function LevelMap() {
  const { account } = useWallet();
  const cleared = useMemo(
    () => (account?.address ? loadProgress(account.address) : []),
    [account?.address],
  );
  const clearedSet = useMemo(() => new Set(cleared), [cleared]);
  const levels = useMemo(
    () => levelsForUI(account?.address, cleared),
    [account?.address, cleared],
  );

  return (
    <section aria-labelledby="level-map-title">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 id="level-map-title" className="text-sm font-semibold text-content">
          Levels
        </h2>
        <span className="font-mono text-xs text-content-subtle">
          {clearedSet.size} / {MAX_LEVEL} cleared
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {levels.map(({ n, difficulty, unlocked }) => {
          const { empties } = economicsForLevel(n);
          const done = clearedSet.has(n);
          return (
            <Link
              key={n}
              href={unlocked ? `/play/${n}` : "#"}
              aria-disabled={!unlocked}
              tabIndex={unlocked ? undefined : -1}
              className={cn(
                "flex flex-col gap-1 rounded-lg border border-line bg-surface p-4",
                "transition-colors duration-100",
                unlocked
                  ? "hover:border-line-strong"
                  : "pointer-events-none opacity-60",
              )}
            >
              <span className="font-mono text-lg text-content">Level {pad(n)}</span>
              <span className="text-xs text-content-muted">
                {difficulty} - {empties} empty
              </span>
              <span className="mt-1">
                {done ? (
                  <span className="inline-flex rounded-sm bg-accent/10 px-1.5 py-0.5 text-[11px] leading-none text-accent-hover">
                    cleared
                  </span>
                ) : !unlocked ? (
                  <span className="inline-flex rounded-sm bg-surface-2 px-1.5 py-0.5 text-[11px] leading-none text-content-subtle">
                    locked
                  </span>
                ) : (
                  <span className="inline-flex text-[11px] leading-none text-transparent">-</span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
