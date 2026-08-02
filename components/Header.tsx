import Link from "next/link";
import { WalletBadge } from "./WalletBadge";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-shelby-border bg-shelby-surface/50 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-shelby-accent to-shelby-accent2" />
        <Link href="/" className="font-semibold tracking-tight">
          Sudoku on Shelby
        </Link>
        <span className="rounded bg-shelby-bg px-2 py-0.5 text-xs text-shelby-muted">
          Shelby × Aptos
        </span>
      </div>
      <nav className="hidden gap-4 text-sm text-shelby-muted md:flex">
        <Link href="/" className="hover:text-shelby-fg-strong">Levels</Link>
        <Link href="/#leaderboard" className="hover:text-shelby-fg-strong">Leaderboard</Link>
        <Link href="/#badges" className="hover:text-shelby-fg-strong">Badges</Link>
        <Link href="/curator" className="hover:text-shelby-fg-strong">Curator</Link>
      </nav>
      <WalletBadge />
    </header>
  );
}