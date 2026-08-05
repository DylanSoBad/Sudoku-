"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check } from "lucide-react";
import { isDailyCompleted } from "@/lib/daily";
import { DAILY_BONUS_MULT, REWARD_PER_LEVEL_SUSD } from "@/lib/tokenomics";
import { utcDateKey } from "@/lib/streak";
import { cn } from "@/lib/utils";

export function DailyCard() {
  const [done, setDone] = useState(false);
  const [dateKey, setDateKey] = useState("");
  const reward = Math.round(REWARD_PER_LEVEL_SUSD * DAILY_BONUS_MULT * 1000) / 1000;

  useEffect(() => {
    setDateKey(utcDateKey());
    setDone(isDailyCompleted());
    const onDaily = () => setDone(isDailyCompleted());
    window.addEventListener("shelby:daily", onDaily);
    return () => window.removeEventListener("shelby:daily", onDaily);
  }, []);

  return (
    <section
      aria-labelledby="daily-title"
      className={cn(
        "relative overflow-hidden rounded-lg border border-line bg-surface/80 p-6",
        "transition-[border-color] duration-200 hover:border-accent/35",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="h-5 w-5 text-accent" aria-hidden />
            <h2
              id="daily-title"
              className="font-display text-xl font-semibold tracking-tight text-content"
            >
              Daily challenge
            </h2>
            {done ? (
              <span className="inline-flex items-center gap-1 rounded-sm bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent-hover">
                <Check className="h-3 w-3" /> Done
              </span>
            ) : (
              <span className="inline-flex rounded-sm bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent-hover">
                {DAILY_BONUS_MULT}x reward
              </span>
            )}
          </div>
          <p className="max-w-md text-sm text-content-muted">
            UTC {dateKey || "…"} ·{" "}
            <span className="font-mono text-content-subtle">
              shelby-sudoku-daily-{dateKey || "YYYYMMDD"}
            </span>
          </p>
          <p className="font-mono text-sm text-accent-hover">+{reward} sUSD</p>
        </div>
        <Link
          href="/play/daily"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-accent px-6 text-sm font-semibold text-white transition-colors duration-150 hover:bg-accent-hover"
          aria-label="Play daily challenge"
        >
          {done ? "Replay daily" : "Play daily"}
        </Link>
      </div>
    </section>
  );
}
