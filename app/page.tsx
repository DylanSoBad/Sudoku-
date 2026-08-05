import Link from "next/link";
import { LevelMap } from "@/components/LevelMap";
import { Leaderboard } from "@/components/Leaderboard";
import { BadgesPanel } from "@/components/badges-panel";
import { ReferralCard } from "@/components/referral-card";
import { SeasonPassCard } from "@/components/season-pass-card";
import { DailyCard } from "@/components/daily-card";
import { StreakBadge } from "@/components/streak-badge";
import { RevenueSplitBar } from "@/components/revenue-split";
import { SettingsPanel } from "@/components/settings-panel";
import { OnboardingTour } from "@/components/onboarding-tour";
import { ReadLedger } from "@/components/read-ledger";
import { HeroGrid } from "@/components/HeroGrid";

export default function HomePage() {
  return (
    <main className="flex flex-col">
      {/* First viewport: one composition — brand, line, CTAs, full-bleed grid */}
      <section className="relative isolate min-h-[calc(100svh-3.5rem)] overflow-hidden border-b border-line/60">
        <HeroGrid />
        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-6xl flex-col justify-center px-6 py-16 sm:py-20">
          <div className="max-w-xl">
            <h1 className="animate-fade-up font-display text-5xl font-bold tracking-tight text-content sm:text-6xl">
              Sudoku on Shelby
            </h1>
            <span
              aria-hidden
              className="animate-underline-in mt-3 block h-0.5 w-24 bg-accent"
            />
            <p className="animate-fade-up-delay-1 mt-6 text-lg text-content-muted sm:text-xl">
              Every puzzle is a blob on Shelby.
            </p>
            <p className="animate-fade-up-delay-2 mt-2 max-w-md text-sm leading-relaxed text-content-subtle sm:text-base">
              Buy hints with shelbyUSD. Clear twenty levels. Claim rewards on Aptos.
            </p>
            <div className="animate-fade-up-delay-3 mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/play/1"
                className="inline-flex h-11 items-center rounded-md bg-accent px-6 text-sm font-semibold text-white transition-colors duration-150 hover:bg-accent-hover"
              >
                Play level 1
              </Link>
              <Link
                href="/play/daily"
                className="inline-flex h-11 items-center rounded-md border border-line-strong bg-surface/80 px-6 text-sm font-medium text-content backdrop-blur-sm transition-colors duration-150 hover:border-accent/50 hover:text-accent-hover"
              >
                Daily challenge
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-6 py-14">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-content-muted">Campaign map</p>
          <StreakBadge />
        </div>

        <LevelMap />

        <DailyCard />

        <section id="leaderboard">
          <Leaderboard />
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <SeasonPassCard />
          <ReferralCard />
        </section>

        <section id="badges">
          <BadgesPanel />
        </section>

        <RevenueSplitBar />

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8 text-xs text-content-subtle">
          <span>
            Built on Aptos testnet. Blob storage via Shelby Protocol. Not financial advice.
          </span>
          <SettingsPanel />
        </footer>
      </div>

      <ReadLedger />
      <OnboardingTour />
    </main>
  );
}
