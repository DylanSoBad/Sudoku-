"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Props {
  level: number;
  address: string;
  ms: number;
  ts: number;
}

function fmt(ms: number): string {
  if (!ms) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ReplayView({ level, address, ms, ts }: Props) {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Replay</h1>
        <p className="text-sm text-shelby-muted">
          Level {level} · {address.slice(0, 10)}…
        </p>
      </header>
      <div className="rounded-xl border border-shelby-border bg-shelby-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-shelby-muted">Time</div>
            <div className="text-2xl font-semibold tabular-nums">{fmt(ms)}</div>
          </div>
          <div>
            <div className="text-xs text-shelby-muted">Solved</div>
            <div className="text-sm">{ts ? new Date(ts).toLocaleString() : "—"}</div>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button asChild>
          <Link href={`/play/${level}`}>Play again</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/">Back to map</Link>
        </Button>
      </div>
    </main>
  );
}