"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      theme="dark"
      position="top-right"
      icons={{ success: null, info: null, warning: null, error: null, loading: null }}
      toastOptions={{
        style: {
          background: "var(--surface)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          borderRadius: "var(--r-lg)",
          fontSize: "14px",
        },
      }}
    />
  );
}
