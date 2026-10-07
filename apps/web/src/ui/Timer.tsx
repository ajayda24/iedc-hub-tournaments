"use client";
import { useEffect, useRef } from "react";
import { cx, fmtClock } from "@/lib/format";
import { sfx } from "./sfx";

/** A pencil-line countdown: shrinks, turns coral near the end, ticks the last 5 seconds. */
export function TimerBar({ endsAt, total, now, paused, big }: { endsAt: number; total: number; now: number; paused?: number | null; big?: boolean }) {
  const left = paused ?? Math.max(0, endsAt - now);
  const frac = Math.max(0, Math.min(1, left / total));
  const urgent = left < 10_000;
  const lastTick = useRef(-1);
  useEffect(() => {
    const s = Math.ceil(left / 1000);
    if (!paused && s <= 5 && s > 0 && s !== lastTick.current) {
      lastTick.current = s;
      sfx.tick();
    }
  }, [left, paused]);
  return (
    <div className="flex items-center gap-3">
      <div className={cx("relative flex-1 overflow-hidden rounded-full border-[2.5px] border-ink bg-card", big ? "h-6" : "h-4")}>
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-200 ease-linear"
          style={{
            width: `${frac * 100}%`,
            background: urgent ? "var(--color-coral)" : "var(--color-yellow)",
            backgroundImage: "repeating-linear-gradient(-45deg, transparent 0 8px, rgb(29 27 22 / 0.08) 8px 12px)",
          }}
        />
      </div>
      <span className={cx("font-extrabold tabular-nums", big ? "text-4xl" : "text-xl", urgent && !paused && "text-stamp")}>
        {paused != null ? "II" : fmtClock(left)}
      </span>
    </div>
  );
}
