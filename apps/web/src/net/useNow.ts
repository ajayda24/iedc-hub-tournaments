"use client";
import { useEffect, useState } from "react";
import { serverNow } from "./arena";

/** Server-synced "now", re-rendering every `everyMs`. */
export function useServerNow(everyMs = 200, active = true) {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(serverNow()), everyMs);
    return () => clearInterval(t);
  }, [everyMs, active]);
  return now;
}
