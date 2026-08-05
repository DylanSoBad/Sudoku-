"use client";

import Link from "next/link";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { levelsForUI } from "@/lib/levels";
import { loadProgress } from "@/lib/progress";
import { cn } from "@/lib/utils";
import { MAX_LEVEL, economicsForLevel } from "@/lib/tokenomics";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function LevelMap() {
  const { account } = useWallet();
  const address = account?.address;
  const [cleared, setCleared] = useState<number[]>([]);

  const refresh = useCallback(() => {
    setCleared(address ? loadProgress(address) : []);
  }, [address]);

  // Progress is written on another route (the play page), so re-read it on
  // mount, on the progress event, and whenever the tab regains focus.
  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("shelby:progress", refresh);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("shelby:progress", refresh);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  const clearedSet = useMemo(() => new Set(cleared), [cleared]);
  const levels = useMemo(() => levelsForUI(address, cleared), [address, cleared]);

  return (
    <section aria-labelledby="level-map-title" className="scroll-mt-20" data-tour="levels">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2
            id="level-map-title"
            className="font-display text-2xl font-semibold tracking-tight text-content"
          >
            Levels
          </h2>
          <p className="mt-1 text-sm text-content-muted">Twenty stages. Unlock the next by clearing the last.</p>
        </div>
        <span className="font-mono text-xs tabular-nums text-content-subtle">
          {clearedSet.size} / {MAX_LEVEL}
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
                "group relative flex flex-col gap-1.5 overflow-hidden rounded-lg border border-line bg-surface/80 p-4",
                "transition-[border-color,transform,background-color] duration-200",
                unlocked
                  ? "hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surface-2"
                  : "pointer-events-none opacity-50",
              )}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              />
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-lg font-semibold tracking-tight text-content">
                  Level {pad(n)}
                </span>
                {done ? (
                  <span className="inline-flex rounded-sm bg-accent/10 px-1.5 py-0.5 text-[11px] leading-none text-accent-hover">
                    cleared
                  </span>
                ) : !unlocked ? (
                  <span className="inline-flex rounded-sm bg-surface-2 px-1.5 py-0.5 text-[11px] leading-none text-content-subtle">
                    locked
                  </span>
                ) : null}
              </div>
              <span className="text-xs capitalize text-content-muted">
                {difficulty}
                <span className="text-content-subtle"> · {empties} empty</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
