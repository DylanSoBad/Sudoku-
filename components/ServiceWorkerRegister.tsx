"use client";

import { useEffect } from "react";

/**
 * Registers `/sw.js` once per session. The SW itself is conservative
 * (static assets + network-first navigations); this file only wires it up.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // Skip on localhost during `next dev` so HMR isn't fighting a stale cache.
    if (process.env.NODE_ENV !== "production") return;

    const url = "/sw.js";
    void navigator.serviceWorker.register(url).catch((err) => {
      console.warn("[pwa] service worker register failed", err);
    });
  }, []);

  return null;
}
