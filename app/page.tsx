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

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-8">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-content">
            Sudoku on Shelby
          </h1>
          <p className="text-sm text-content-muted">
            Every puzzle is a blob on Shelby. Buy hints with shelbyUSD, solve for rewards.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StreakBadge />
          <Link
            href="/play/1"
            className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-white transition-colors duration-100 hover:bg-accent-hover"
          >
            Play level 1
          </Link>
          <Link
            href="/play/daily"
            className="inline-flex h-9 items-center rounded-md border border-line bg-surface-2 px-4 text-sm font-medium text-content transition-colors duration-100 hover:border-line-strong"
          >
            Daily challenge
          </Link>
        </div>
      </section>

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

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-xs text-content-subtle">
        <span>
          Built on Aptos testnet. Blob storage via Shelby Protocol. Not financial advice.
        </span>
        <SettingsPanel />
      </footer>

      <ReadLedger />
      <OnboardingTour />
    </main>
  );
}
