"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "default" | "accent" | "success" | "warn" | "danger" | "gold" | "muted";

const tones: Record<BadgeTone, string> = {
  default: "bg-shelby-bg text-shelby-muted border-shelby-border",
  accent: "bg-shelby-accent/15 text-shelby-accent border-shelby-accent/30",
  success: "bg-shelby-success/15 text-shelby-success border-shelby-success/30",
  warn: "bg-shelby-warn/15 text-shelby-warn border-shelby-warn/30",
  danger: "bg-shelby-danger/15 text-shelby-danger border-shelby-danger/30",
  gold: "bg-amber-300/15 text-amber-200 border-amber-300/30",
  muted: "bg-shelby-surface text-shelby-muted border-shelby-border",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: BadgeTone;
}

export function Badge({ className, tone, variant, ...rest }: BadgeProps) {
  const t = tone ?? variant ?? "default";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
        tones[t],
        className,
      )}
      {...rest}
    />
  );
}
