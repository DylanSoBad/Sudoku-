"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Menu, X } from "lucide-react";
import { WalletBadge } from "./WalletBadge";
import { ReadLedgerCounter } from "./ReadLedgerCounter";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Levels", match: (p: string) => p === "/" || p.startsWith("/play") },
  { href: "/#leaderboard", label: "Leaderboard", match: () => false },
];

export function Header() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // Close the drawer on route change or Escape.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/" className="group flex min-w-0 items-center gap-2.5" onClick={() => setOpen(false)}>
            {/* unoptimized: the image optimizer rejects SVG unless dangerouslyAllowSVG is on. */}
            <Image
              src="/icons/icon.svg?v=3"
              alt=""
              width={28}
              height={28}
              unoptimized
              className="h-7 w-7 shrink-0 rounded-md ring-1 ring-line transition-transform duration-200 group-hover:scale-[1.04]"
              priority
            />
            <span className="truncate font-display text-sm font-semibold tracking-tight text-content">
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
          <div className="hidden sm:block">
            <ReadLedgerCounter />
          </div>
          <WalletBadge />
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-content-muted transition-colors duration-150 hover:border-line-strong hover:text-content md:hidden"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id={panelId}
          className="border-t border-line/80 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
        >
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-x-0 bottom-0 top-14 z-40 bg-bg/60"
            onClick={() => setOpen(false)}
          />
          <nav className="relative z-50 flex flex-col gap-1 bg-bg px-4 py-3">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-3 text-sm transition-colors duration-150",
                    active
                      ? "bg-surface-2 text-content"
                      : "text-content-muted hover:bg-surface hover:text-content",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="border-t border-line/60 px-3 pb-1 pt-3 sm:hidden">
              <ReadLedgerCounter />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
