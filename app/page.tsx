import Link from "next/link";
import { Header } from "@/components/Header";
import { LevelMap } from "@/components/LevelMap";
import { Leaderboard } from "@/components/Leaderboard";
import { FaucetPanel } from "@/components/Faucet";
import { BadgesPanel } from "@/components/badges-panel";
import { ReferralCard } from "@/components/referral-card";
import { SeasonPassCard } from "@/components/season-pass-card";
import { DailyCard } from "@/components/daily-card";
import { StreakBadge } from "@/components/streak-badge";
import { RevenueSplitBar } from "@/components/revenue-split";
import { SettingsPanel } from "@/components/settings-panel";
import { OnboardingTour } from "@/components/onboarding-tour";
import { ReadLedger } from "@/components/read-ledger";
import { ToastProvider } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-shelby-bg text-shelby-fg-strong">
      <ToastProvider />
      <Header />
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-shelby-accent2">
            Aptos × Shelby
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Sudoku on Shelby
          </h1>
          <p className="max-w-2xl text-sm text-shelby-muted">
            Every puzzle is a blob on Shelby. Buy hints with shelbyUSD, solve for rewards, climb 20+ levels of scaling difficulty.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-shelby-accent/15 px-3 py-1 text-xs text-shelby-accent">
              Shelby hot storage · Aptos testnet
            </span>
            <StreakBadge />
            <span className="ml-2 inline-flex gap-2">
              <Button asChild variant="primary" size="sm">
                <Link href="/play/1">Play Level 1</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/play/daily">Daily Challenge</Link>
              </Button>
            </span>
          </div>
        </section>

        <section>
          <LevelMap />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <DailyCard />
          <FaucetPanel
            kind="apt"
            label="Aptos testnet APT"
            endpoint="/api/faucet/apt"
          />
        </section>

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

        <section>
          <RevenueSplitBar />
        </section>

        <footer className="flex items-center justify-between border-t border-shelby-border pt-6 text-xs text-shelby-muted">
          <span>Built on Aptos testnet · Blob storage via Shelby Protocol · Not financial advice</span>
          <SettingsPanel />
        </footer>
      </main>
      <ReadLedger />
      <OnboardingTour />
    </div>
  );
}
