"use client";

import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getReadLedger, type ReadLedgerEntry } from "@/lib/shelby";
import { short } from "@/lib/utils";

export function ReadLedger() {
  const [entries, setEntries] = useState<ReadLedgerEntry[]>([]);

  useEffect(() => {
    setEntries(getReadLedger());
    const onRead = () => setEntries(getReadLedger());
    window.addEventListener("shelby:read", onRead);
    return () => window.removeEventListener("shelby:read", onRead);
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-shelby-accent2" />
          <CardTitle>Read Ledger</CardTitle>
          <Badge variant="accent">{entries.length}</Badge>
        </div>
        <CardDescription>
          Live log of Shelby blob downloads (persisted in localStorage).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-shelby-muted">
            No reads yet. Open a level to fetch a puzzle blob.
          </p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {entries.map((e, i) => (
              <li
                key={`${e.at}-${e.blobName}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-shelby-border/60 bg-shelby-bg/40 px-3 py-2"
              >
                <div>
                  <span className="font-medium text-white">L{e.level}</span>
                  <span className="mx-2 text-shelby-muted">·</span>
                  <span className="font-mono text-xs text-shelby-muted">{e.blobName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      e.source === "shelby"
                        ? "accent"
                        : e.source === "cache" || e.source === "mirror"
                          ? "muted"
                          : "gold"
                    }
                  >
                    {e.source}
                  </Badge>
                  <span className="text-xs text-shelby-muted">
                    {short(e.owner, 4, 4)} · {e.bytes}B
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
