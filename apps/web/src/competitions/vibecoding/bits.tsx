"use client";
import { useEffect, useState } from "react";
import type { ClockView } from "@iedc/shared/competitions/vibecoding/protocol";
import { cx, fmtClock } from "@/lib/format";
import { useVc, vcNow } from "./net";

/** Small shared pieces for the Vibe Hackathon screens. */

export const COMPETITION = "vibecoding";

/** Re-render every `ms` (for clocks and cooldowns). */
export function useTicker(ms = 500) {
  const [, setT] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return vcNow();
}

/** The build clock, ticking locally between server updates. */
export function clockNow(c: ClockView | undefined, now: number) {
  if (!c) return { remainingMs: 0, elapsedMs: 0 };
  const running = c.phase === "build" && !c.paused;
  const drift = running ? Math.max(0, now - c.at) : 0;
  return { remainingMs: Math.max(0, c.remainingMs - drift), elapsedMs: c.elapsedMs + drift };
}

export function Clock({ big, className }: { big?: boolean; className?: string }) {
  const c = useVc((s) => s.wall?.clock);
  const now = useTicker(500);
  const { remainingMs } = clockNow(c, now);
  const low = c?.phase === "build" && remainingMs < 5 * 60_000;
  return (
    <span className={cx("font-black tabular-nums", big ? "text-6xl" : "text-xl", low && "text-stamp", c?.paused && "opacity-50", className)}>
      {fmtClock(remainingMs)}
    </span>
  );
}

export function Toast() {
  const toast = useVc((s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast || !visible) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4" role="status">
      <div className="slip max-w-sm !bg-ink px-4 py-2 text-center font-bold text-paper">{toast.text}</div>
    </div>
  );
}

/** A picture piece (1..8) of the Bulbu doodle: the 3×3 grid of a square image. */
export function Piece({ n, size, faded }: { n: number; size: number; faded?: boolean }) {
  if (n === 0) return <div style={{ width: size, height: size }} className="rounded-md border-2 border-dashed border-ink/30" />;
  const i = n - 1;
  const x = (i % 3) * size;
  const y = Math.floor(i / 3) * size;
  return (
    <div
      className={cx("overflow-hidden rounded-md border-2 border-ink", faded && "opacity-25")}
      style={{ width: size, height: size, position: "relative", background: "var(--color-card)" }}
      aria-label={`piece ${n}`}
    >
      <div style={{ position: "absolute", left: -x, top: -y, width: size * 3, height: size * 3 }}>
        <BulbuPicture size={size * 3} />
      </div>
      <span className="absolute bottom-0 right-1 text-[10px] font-black opacity-40">{n}</span>
    </div>
  );
}

/** The puzzle picture: Bulbu the lightbulb on a sunny notebook page (pure SVG, no files). */
export function BulbuPicture({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 300 300" aria-hidden>
      <rect width="300" height="300" fill="#fff6d8" />
      <g stroke="#cfe0ff" strokeWidth="1">
        {Array.from({ length: 15 }, (_, k) => (
          <line key={k} x1="0" x2="300" y1={k * 20 + 10} y2={k * 20 + 10} />
        ))}
      </g>
      <line x1="40" x2="40" y1="0" y2="300" stroke="#ff9a9a" strokeWidth="2" />
      <circle cx="250" cy="52" r="30" fill="#ffd84d" stroke="#1d1b16" strokeWidth="3" />
      <g stroke="#1d1b16" strokeWidth="3" strokeLinecap="round">
        <line x1="250" y1="8" x2="250" y2="16" />
        <line x1="206" y1="52" x2="214" y2="52" />
        <line x1="286" y1="52" x2="294" y2="52" />
        <line x1="219" y1="21" x2="225" y2="27" />
      </g>
      <path d="M150 48c-46 0-76 34-72 74 3 28 22 42 30 60 5 11 6 22 6 30h72c0-8 1-19 6-30 8-18 27-32 30-60 4-40-26-74-72-74z" fill="#ffe873" stroke="#1d1b16" strokeWidth="4" />
      <rect x="114" y="212" width="72" height="16" rx="5" fill="#cfd6e4" stroke="#1d1b16" strokeWidth="4" />
      <rect x="120" y="228" width="60" height="14" rx="5" fill="#cfd6e4" stroke="#1d1b16" strokeWidth="4" />
      <path d="M138 242h24l-6 12h-12z" fill="#1d1b16" />
      <circle cx="130" cy="120" r="8" fill="#1d1b16" />
      <circle cx="170" cy="120" r="8" fill="#1d1b16" />
      <circle cx="133" cy="117" r="2.5" fill="#fff" />
      <circle cx="173" cy="117" r="2.5" fill="#fff" />
      <path d="M128 150c12 14 32 14 44 0" fill="none" stroke="#1d1b16" strokeWidth="4" strokeLinecap="round" />
      <circle cx="112" cy="142" r="7" fill="#ff9a9a" opacity=".7" />
      <circle cx="188" cy="142" r="7" fill="#ff9a9a" opacity=".7" />
      <g fill="none" stroke="#1d1b16" strokeWidth="3" strokeLinecap="round">
        <path d="M80 70l-18-14M74 108h-22M84 150l-18 10M220 108h22M214 150l18 10" />
      </g>
      <text x="62" y="282" fontFamily="Caveat, cursive" fontSize="26" fill="#1d1b16">
        build. break. launch.
      </text>
    </svg>
  );
}

export const fmtMin = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}`;
