"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-shelby-border bg-shelby-bg px-3 py-2 text-sm text-shelby-fg-strong",
        "placeholder:text-shelby-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shelby-accent",
        className,
      )}
      {...rest}
    />
  );
});
