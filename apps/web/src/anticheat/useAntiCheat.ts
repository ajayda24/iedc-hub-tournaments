"use client";
import { useEffect, useRef, useState } from "react";
import { EV, type CheatAction, type CheatKind } from "@iedc/shared/protocol";
import { emit, emitAck } from "@/net/arena";
import { PHONE_PROBE_URLS } from "@iedc/data/network";
import { ANTICHEAT } from "@iedc/data/rules";
import { anticheat as A } from "@iedc/data/copy/anticheat";

/**
 * Public endpoints that answer instantly when a device has internet (see data/network.ts).
 * On the event Wi-Fi every probe fails; a success means mobile data, a VPN or a
 * second network is on — exactly what someone asking an AI needs.
 */
const PROBE_URLS = PHONE_PROBE_URLS;
const PROBE_EVERY_MS = ANTICHEAT.probeEveryMs;
const PROBE_TIMEOUT_MS = ANTICHEAT.probeTimeoutMs;
const FOCUS_GRACE_MS = ANTICHEAT.focusGraceMs;

export function probeInternet(timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let failed = 0;
    const ctrl = new AbortController();
    const finish = (v: boolean) => {
      if (settled) return;
      settled = true;
      ctrl.abort();
      resolve(v);
    };
    setTimeout(() => finish(false), timeoutMs);
    for (const url of PROBE_URLS) {
      fetch(`${url}?_=${Date.now()}`, { mode: "no-cors", cache: "no-store", signal: ctrl.signal, credentials: "omit" })
        .then(() => finish(true))
        .catch(() => {
          if (++failed === PROBE_URLS.length) finish(false);
        });
    }
  });
}

export interface Strike {
  at: number;
  kind: CheatKind;
  action: CheatAction;
  ms?: number;
}

/**
 * - `probe`: keep checking for internet while joined (when the host requires it)
 * - `watchFocus`: count leaving the app/tab during a live round
 */
export function useAntiCheat({ probe, watchFocus }: { probe: boolean; watchFocus: boolean }) {
  const [internet, setInternet] = useState(false);
  const [strike, setStrike] = useState<Strike | null>(null);
  const internetRef = useRef(false);
  const misses = useRef(0);

  const report = async (kind: CheatKind, extra: { ms?: number; detail?: string } = {}) => {
    try {
      const res = await emitAck<{ action: CheatAction }>(EV.cheat, { kind, ...extra });
      if (res.action !== "noted") setStrike({ at: Date.now(), kind, action: res.action, ms: extra.ms });
    } catch {
      /* offline: the server will see the flag on the next probe */
    }
  };

  useEffect(() => {
    if (!probe) {
      if (internetRef.current) emit(EV.cheatClear);
      internetRef.current = false;
      setInternet(false);
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      const online = await probeInternet();
      if (!alive) return;
      if (online) {
        misses.current = 0;
        // report every time while it lasts: the server strikes once per round
        void report("internet", { detail: A.flagInternet });
        if (!internetRef.current) {
          internetRef.current = true;
          setInternet(true);
        }
      } else if (internetRef.current && ++misses.current >= 2) {
        internetRef.current = false;
        setInternet(false);
        emit(EV.cheatClear);
      }
      timer = setTimeout(run, internetRef.current ? ANTICHEAT.probeWhileOnlineMs : PROBE_EVERY_MS);
    };
    void run();
    const kick = () => {
      clearTimeout(timer);
      void run();
    };
    window.addEventListener("online", kick);
    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener("online", kick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probe]);

  useEffect(() => {
    if (!watchFocus) return;
    let awayAt: number | null = null;
    let why = "";
    const away = (reason: string) => {
      if (awayAt === null) {
        awayAt = Date.now();
        why = reason;
      }
    };
    const back = () => {
      if (awayAt === null) return;
      const ms = Date.now() - awayAt;
      awayAt = null;
      if (ms >= FOCUS_GRACE_MS) void report("focus", { ms, detail: why });
    };
    const onVis = () => (document.hidden ? away(A.leftApp) : back());
    const onBlur = () => away(A.leftWindow);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", back);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", back);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchFocus]);

  return { internet, strike, clearStrike: () => setStrike(null) };
}

/** Block copy / long-press menus inside the game area. */
export function useNoCopy(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const stop = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea")) return;
      e.preventDefault();
    };
    document.addEventListener("copy", stop);
    document.addEventListener("cut", stop);
    document.addEventListener("contextmenu", stop);
    return () => {
      document.removeEventListener("copy", stop);
      document.removeEventListener("cut", stop);
      document.removeEventListener("contextmenu", stop);
    };
  }, [active]);
}
