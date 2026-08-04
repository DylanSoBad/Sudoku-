"use client";

import { useEffect, useState } from "react";
import { getReadLedger } from "@/lib/shelby";

/**
 * Compact counter for the global header — mirrors the data source of the
 * full <ReadLedger /> card but renders as a single chip instead of a Card.
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
      title="Successful puzzle fetches"
      className="hidden items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 text-xs sm:inline-flex"
    >
      <span className="font-mono text-content">{count}</span>
      <span className="text-content-muted">reads</span>
    </span>
  );
}
