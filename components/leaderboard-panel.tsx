"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/leaderboard";
import { short } from "@/lib/utils";

function formatMs(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function LeaderboardPanel() {
  const [level, setLevel] = useState(1);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getLeaderboard(level);
      setEntries(rows);
    } finally {
      setLoading(false);
    }
  }, [level]);

  useEffect(() => {
    void refresh();
    const onLb = () => void refresh();
    window.addEventListener("shelby:leaderboard", onLb);
    return () => window.removeEventListener("shelby:leaderboard", onLb);
  }, [refresh]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-shelby-gold" />
            <CardTitle>Leaderboard</CardTitle>
          </div>
          <label className="flex items-center gap-2 text-xs text-shelby-muted">
            Level
            <select
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="rounded-md border border-shelby-border bg-shelby-bg px-2 py-1 font-mono text-white"
              aria-label="Leaderboard level"
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={0}>Daily</option>
            </select>
          </label>
        </div>
        <CardDescription>
          Top 10 by solve time. Indexer when registry is set; otherwise local results.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-shelby-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-shelby-muted">No scores yet for this level.</p>
        ) : (
          <ol className="space-y-2">
            {entries.map((e, i) => (
              <li
                key={`${e.addr}-${e.at}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md border border-shelby-border/60 bg-shelby-bg/40 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 font-mono text-shelby-muted">{i + 1}</span>
                  <span className="truncate font-mono text-white" title={e.addr}>
                    {short(e.addr)}
                  </span>
                  {e.source === "local" ? (
                    <Badge variant="muted" className="text-[10px]">
                      local
                    </Badge>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3 font-mono text-xs text-shelby-muted">
                  <span>{formatMs(e.time_ms ?? e.ms)}</span>
                  <span>{e.hints_used}h</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
