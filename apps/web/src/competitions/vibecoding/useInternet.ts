"use client";
import { useEffect, useRef } from "react";
import { EVC } from "@iedc/shared/competitions/vibecoding/protocol";
import { ANTICHEAT } from "@iedc/config/rules";
import { probeInternet } from "@/anticheat/useAntiCheat";
import { vcEmit } from "./net";

/**
 * The same internet probe as the weekly games: if this phone can reach the
 * internet (mobile data, VPN), the arena blocks its Asks until it can't.
 */
export function useInternetReport(active: boolean) {
  const last = useRef<boolean | null>(null);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      const online = await probeInternet();
      if (!alive) return;
      if (online !== last.current) {
        last.current = online;
        vcEmit(EVC.internet, { online });
      }
      timer = setTimeout(run, ANTICHEAT.probeEveryMs);
    };
    void run();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [active]);
}
