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
        "flex h-9 w-full rounded-md border border-line bg-surface-2 px-3 text-sm text-content",
        "transition-colors duration-100 placeholder:text-content-subtle",
        "focus-visible:border-line-strong focus-visible:outline-none",
        className,
      )}
      {...rest}
    />
  );
});
