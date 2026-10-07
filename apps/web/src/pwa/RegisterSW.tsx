"use client";
import { useEffect } from "react";
import { isArenaOrigin } from "@/lib/arena";

/**
 * The service worker only makes sense on the online site: it caches the app
 * and practice games so they work offline and update when back online. On the
 * event LAN the arena laptop serves fresh files every time, so we skip it.
 */
export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    if (isArenaOrigin() || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
