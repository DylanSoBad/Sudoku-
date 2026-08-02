"use client";

import { useEffect, useState } from "react";
import { allEntries, type Entry } from "@/lib/leaderboard";
import { Button } from "@/components/ui/button";
import { MAX_LEVEL } from "@/lib/tokenomics";

const TABS = ["Level", ...Array.from({ length: MAX_LEVEL }, (_, i) => String(i + 1)), "Daily"];

function fmtMs(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Leaderboard() {
  const [tab, setTab] = useState<string>("Level");
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    setEntries(allEntries());
  }, [tab]);

  const filtered = (() => {
    if (tab === "Level") return entries;
    if (tab === "Daily") return entries.filter((e) => e.level === 0);
    const lvl = Number(tab);
    return entries.filter((e) => e.level === lvl).slice(0, 10);
  })();

  return (
    <section id="leaderboard" aria-labelledby="leaderboard-title">
      <h2 id="leaderboard-title" className="mb-3 text-sm font-semibold uppercase tracking-wider text-shelby-muted">
        Leaderboard
      </h2>
      <p className="mb-3 text-xs text-shelby-muted">
        Top 10 by solve time. Indexer when registry is set; otherwise local results.
      </p>
      <div className="mb-3 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={t === tab ? "primary" : "secondary"}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-shelby-border">
        <table className="w-full text-sm">
          <thead className="bg-shelby-surface text-xs uppercase tracking-wider text-shelby-muted">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Wallet</th>
              <th className="px-3 py-2 text-left">Level</th>
              <th className="px-3 py-2 text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-shelby-muted">
                  Loading…
                </td>
              </tr>
            ) : (
              filtered.slice(0, 10).map((e, i) => (
                <tr key={`${e.address}-${e.ts}`} className="border-t border-shelby-border">
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.address.slice(0, 10)}…</td>
                  <td className="px-3 py-2">{e.level === 0 ? "Daily" : e.level}</td>
                  <td className="px-3 py-2 text-right">{fmtMs(e.ms)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}