"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletBadge } from "./WalletBadge";
import { ReadLedgerCounter } from "./ReadLedgerCounter";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Levels", match: (p: string) => p === "/" || p.startsWith("/play") },
  { href: "/curator", label: "Curator", match: (p: string) => p.startsWith("/curator") },
  { href: "/#leaderboard", label: "Leaderboard", match: () => false },
];

export function Header() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-line/80 bg-bg/70 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-6 px-6">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="group flex items-center gap-2.5">
            {/* unoptimized: the image optimizer rejects SVG unless dangerouslyAllowSVG is on. */}
            <Image
              src="/icons/icon.svg?v=3"
              alt=""
              width={28}
              height={28}
              unoptimized
              className="h-7 w-7 rounded-md ring-1 ring-line transition-transform duration-200 group-hover:scale-[1.04]"
              priority
            />
            <span className="font-display text-sm font-semibold tracking-tight text-content">
              Sudoku on Shelby
            </span>
          </Link>
          <span className="hidden rounded-sm bg-surface-2 px-1.5 py-0.5 text-[11px] leading-none text-content-muted sm:inline">
            testnet
          </span>
        </div>

        <nav className="hidden h-full items-stretch gap-6 text-sm md:flex">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center transition-colors duration-150",
                  active ? "text-content" : "text-content-muted hover:text-content",
                )}
              >
                {item.label}
                {active ? (
                  <span className="absolute inset-x-0 bottom-0 h-px bg-accent" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ReadLedgerCounter />
          <WalletBadge />
        </div>
      </div>
    </header>
  );
}
