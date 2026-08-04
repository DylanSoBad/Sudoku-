"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "default" | "accent" | "success" | "warn" | "danger" | "gold" | "muted";

const tones: Record<BadgeTone, string> = {
  default: "border-line bg-surface-2 text-content-muted",
  accent: "border-accent/30 bg-accent/10 text-accent-hover",
  success: "border-line bg-surface-2 text-success",
  warn: "border-line bg-surface-2 text-content-muted",
  danger: "border-line bg-surface-2 text-danger",
  gold: "border-accent/30 bg-accent/10 text-accent-hover",
  muted: "border-line bg-surface text-content-subtle",
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
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] leading-none tracking-wide",
        tones[t],
        className,
      )}
      {...rest}
    />
  );
}
