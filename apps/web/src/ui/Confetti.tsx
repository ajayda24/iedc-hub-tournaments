"use client";
import { useMemo } from "react";

const COLORS = ["#ffe45c", "#7ee0b5", "#ff7a59", "#7cc6fe", "#fffdf8"];

/** Torn paper scraps falling, not glitter. CSS only. */
export function Confetti({ pieces = 36, seed = 1 }: { pieces?: number; seed?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => {
        const r = (n: number) => ((Math.sin(seed * 9301 + i * 49297 + n * 233) + 1) / 2) % 1;
        return {
          left: r(1) * 100,
          delay: r(2) * 0.6,
          dur: 1.6 + r(3) * 1.4,
          w: 8 + r(4) * 10,
          h: 6 + r(5) * 8,
          rot: r(6) * 360,
          drift: (r(7) - 0.5) * 160,
          color: COLORS[i % COLORS.length],
        };
      }),
    [pieces, seed],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute top-[-20px] border-[1.5px] border-ink"
          style={{
            left: `${b.left}%`,
            width: b.w,
            height: b.h,
            background: b.color,
            clipPath: "polygon(0 10%, 30% 0, 100% 15%, 90% 100%, 40% 85%, 5% 100%)",
            animation: `scrap-fall ${b.dur}s cubic-bezier(.3,.6,.6,1) ${b.delay}s both`,
            ["--drift" as string]: `${b.drift}px`,
            ["--rot" as string]: `${b.rot}deg`,
          }}
        />
      ))}
      <style>{`@keyframes scrap-fall{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(var(--drift),110vh) rotate(calc(var(--rot) + 540deg))}}`}</style>
    </div>
  );
}
