"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export interface LevelPlayProps {
  level: number;
}

export function LevelPlay({ level }: LevelPlayProps) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Level {level}</h1>
        <Link href="/" className="text-sm text-shelby-muted hover:text-shelby-fg-strong">
          ← Back to map
        </Link>
      </header>
      <div className="rounded-xl border border-shelby-border bg-shelby-surface p-6">
        <p className="text-sm text-shelby-muted">
          The interactive board is wired through{" "}
          <code>components/Board.tsx</code>, <code>usePuzzle()</code>, and <code>HintShop</code>.
          The bootstrapping layout in <code>app/level/[n]/page.tsx</code> renders this shell;
          you can swap in the full board component once the lowercase tree stabilizes.
        </p>
        <div className="mt-4">
          <Button asChild={undefined} variant="primary">
            <Link href="/">Back</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
