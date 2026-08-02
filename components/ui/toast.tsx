"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: "#0f1220",
          border: "1px solid #1e2338",
          color: "#e8eaf2",
        },
      }}
    />
  );
}
