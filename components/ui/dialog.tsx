"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export function Dialog({ open, onClose, onOpenChange, title, description: _description, children }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") (onClose ?? (() => onOpenChange?.(false)))();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onOpenChange]);

  React.useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "dialog-title" : undefined}
      onClick={onClose ?? (() => onOpenChange?.(false))}
    >
      <div
        className={cn(
          "w-full max-w-md rounded-2xl border border-shelby-border bg-shelby-surface p-6 shadow-glow",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 id="dialog-title" className="mb-3 text-lg font-semibold">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
