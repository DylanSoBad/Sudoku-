"use client";

import { HINT_FEE_SPLIT } from "@/lib/tokenomics";
import { useT } from "@/components/app-providers";

export function RevenueSplitBar({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const rows = [
    { key: "treasury" as const, pct: HINT_FEE_SPLIT.treasury, label: t.tokenomics.treasury, color: "bg-shelby-accent" },
    { key: "curator" as const, pct: HINT_FEE_SPLIT.curator, label: t.tokenomics.curator, color: "bg-shelby-accent2" },
    { key: "burn" as const, pct: HINT_FEE_SPLIT.burn, label: t.tokenomics.burn, color: "bg-shelby-gold" },
  ];

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      {!compact ? (
        <p className="text-xs font-medium uppercase tracking-wider text-shelby-muted">
          {t.tokenomics.title}
        </p>
      ) : null}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-shelby-border">
        {rows.map((r) => (
          <div
            key={r.key}
            className={r.color}
            style={{ width: `${r.pct * 100}%` }}
            title={`${r.label} ${Math.round(r.pct * 100)}%`}
          />
        ))}
      </div>
      <div className={`flex flex-wrap gap-x-3 gap-y-1 ${compact ? "text-[10px]" : "text-xs"} text-shelby-muted`}>
        {rows.map((r) => (
          <span key={r.key}>
            <span className="text-white">{Math.round(r.pct * 100)}%</span> {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}
