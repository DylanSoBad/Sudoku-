"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { effectiveStreak } from "@/lib/streak";

export function StreakBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(effectiveStreak());
    const onStreak = () => setCount(effectiveStreak());
    window.addEventListener("shelby:streak", onStreak);
    return () => window.removeEventListener("shelby:streak", onStreak);
  }, []);

  if (count <= 0) return null;

  return (
    <Badge variant="gold" className="gap-1" title="Consecutive UTC days with a solve">
      <Flame className="h-3.5 w-3.5" aria-hidden />
      {count} day streak
    </Badge>
  );
}
