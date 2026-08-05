"use client";

import { useEffect, useState } from "react";
import { allEntries, type Entry } from "@/lib/leaderboard";
import { Button } from "@/components/ui/button";
import { MAX_LEVEL } from "@/lib/tokenomics";

const TABS = ["All", ...Array.from({ length: MAX_LEVEL }, (_, i) => String(i + 1)), "Daily"];

function fmtMs(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function isValidEntry(
  e: Entry,
): e is Entry & { address: string; ts: number; ms: number; level: number } {
  return (
    typeof e?.address === "string" &&
    typeof e?.ts === "number" &&
    typeof e?.ms === "number" &&
    typeof e?.level === "number"
  );
}

export function Leaderboard() {
  const [tab, setTab] = useState<string>("All");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setEntries(allEntries());
      setReady(true);
    };
    refresh();
    window.addEventListener("shelby:balances", refresh);
    window.addEventListener("shelby:leaderboard", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("shelby:balances", refresh);
      window.removeEventListener("shelby:leaderboard", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Drop malformed rows so localStorage from older versions can't crash hydration.
  const safeEntries = entries.filter(isValidEntry).sort((a, b) => a.ms - b.ms);

  const filtered = (() => {
    if (tab === "All") return safeEntries;
    if (tab === "Daily") return safeEntries.filter((e) => e.level === 0);
    const lvl = Number(tab);
    return safeEntries.filter((e) => e.level === lvl);
  })();

  const top = filtered.slice(0, 10);

  return (
    <section id="leaderboard" aria-labelledby="leaderboard-title">
      <h2
        id="leaderboard-title"
        className="mb-2 font-display text-2xl font-semibold tracking-tight text-content"
      >
        Leaderboard
      </h2>
      <p className="mb-4 text-sm text-content-muted">
        Top 10 by solve time on this device. Times stay in your browser until a shared indexer
        ships.
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
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wider text-content-muted">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Wallet</th>
              <th className="px-3 py-2 text-left">Level</th>
              <th className="px-3 py-2 text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {!ready ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-content-muted">
                  Loading…
                </td>
              </tr>
            ) : top.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-content-muted">
                  No solves yet — clear a level to appear here.
                </td>
              </tr>
            ) : (
              top.map((e, i) => (
                <tr key={`${e.address}-${e.ts}-${i}`} className="border-t border-line">
                  <td className="px-3 py-2 text-content-subtle">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs text-content">
                    {e.address.slice(0, 10)}…
                  </td>
                  <td className="px-3 py-2 text-content-muted">
                    {e.level === 0 ? "Daily" : e.level}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtMs(e.ms)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
