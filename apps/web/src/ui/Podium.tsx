"use client";
import type { LbEntry } from "@iedc/shared/protocol";
import { Avatar } from "./Avatar";
import { Mascot } from "./Mascot";
import { cx } from "@/lib/format";

/** Funny titles handed out on the podium. Deterministic per player. */
export function titleFor(e: LbEntry, index: number, total: number): string {
  if (index === 0) return "Certified Big Brain";
  if (index === 1) return "So Close It Hurts";
  if (index === 2) return "Bronze, Baby";
  if (e.streak >= 3) return "Streak Machine";
  if (index === total - 1 && total > 3) return "Participation Legend";
  if (e.solves === 0) return "Vibes Only";
  if (index < total / 3) return "Low-key Genius";
  return "Brain Warming Up";
}

export function Podium({ entries, big }: { entries: LbEntry[]; big?: boolean }) {
  const top = entries.slice(0, 3);
  const order = [top[1], top[0], top[2]];
  const heights = big ? [150, 210, 110] : [90, 130, 70];
  return (
    <div className="flex flex-col items-center">
      <Mascot mood="crown" size={big ? 120 : 72} />
      <div className="mt-2 flex items-end justify-center gap-2 sm:gap-4">
        {order.map((e, i) =>
          e ? (
            <div
              key={e.id}
              className="flex flex-col items-center"
              style={{ animation: `podium-rise 0.7s cubic-bezier(.2,1.4,.4,1) ${[0.6, 1.2, 0.2][i]}s both` }}
            >
              <Avatar seed={e.avatar} size={big ? 84 : 48} />
              <div className={cx("mt-1 max-w-[9rem] truncate text-center font-black", big ? "text-2xl" : "text-sm")}>{e.name}</div>
              <div className={cx("text-pencil", big ? "text-base" : "text-xs")}>{e.dept}</div>
              <div
                className={cx("slip mt-2 flex w-24 flex-col items-center justify-start pt-2 sm:w-32", big && "!w-48")}
                style={{ height: heights[i], background: ["#e9e4d8", "var(--color-yellow)", "#f3c9a2"][i] }}
              >
                <span className={cx("font-black", big ? "text-6xl" : "text-3xl")}>{[2, 1, 3][i]}</span>
                <span className={cx("font-bold tabular-nums", big ? "text-2xl" : "text-sm")}>{e.score}</span>
              </div>
            </div>
          ) : (
            <div key={i} className="w-24 sm:w-32" />
          ),
        )}
      </div>
    </div>
  );
}
