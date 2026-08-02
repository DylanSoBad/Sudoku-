"use client";

import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { getReadLedger } from "@/lib/shelby";

/**
 * Compact counter for the global header — mirrors the data source of the
 * full <ReadLedger /> card but renders as a single pill instead of a Card.
 */
export function ReadLedgerCounter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(getReadLedger().length);
    const onRead = () => setCount(getReadLedger().length);
    window.addEventListener("shelby:read", onRead);
    return () => window.removeEventListener("shelby:read", onRead);
  }, []);

  return (
    <span
      title="Successful puzzle-fetch counter"
      className="inline-flex items-center gap-1.5 rounded-lg border border-shelby-border bg-shelby-surface px-2.5 py-1.5 text-xs text-shelby-fg-strong"
    >
      <BookOpen className="h-3.5 w-3.5 text-shelby-accent2" />
      <span className="font-mono">{count}</span>
      <span className="text-shelby-muted">reads</span>
    </span>
  );
}
