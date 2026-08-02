"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DAILY_LEVEL, isDailyCompleted } from "@/lib/daily";
import { getLevelMeta } from "@/lib/sudoku";
import { utcDateKey } from "@/lib/streak";

export function DailyCard() {
  const [done, setDone] = useState(false);
  const [dateKey, setDateKey] = useState("");
  const meta = getLevelMeta(DAILY_LEVEL);
  const reward = Math.round(meta.reward * 2 * 100) / 100;

  useEffect(() => {
    setDateKey(utcDateKey());
    setDone(isDailyCompleted());
    const onDaily = () => setDone(isDailyCompleted());
    window.addEventListener("shelby:daily", onDaily);
    return () => window.removeEventListener("shelby:daily", onDaily);
  }, []);

  return (
    <Card className="border-shelby-accent/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-shelby-accent" />
          <CardTitle>Daily Challenge</CardTitle>
          {done ? (
            <Badge variant="gold" className="gap-1">
              <Check className="h-3 w-3" /> Done
            </Badge>
          ) : (
            <Badge variant="accent">2× reward</Badge>
          )}
        </div>
        <CardDescription>
          UTC {dateKey || "…"} · blob{" "}
          <span className="font-mono text-shelby-accent">
            shelby-sudoku-daily-{dateKey || "YYYYMMDD"}
          </span>
          . Reward {reward} shelbyUSD.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/play/daily">
          <Button className="w-full" aria-label="Play daily challenge">
            {done ? "Replay daily" : "Play daily"}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
