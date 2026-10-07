"use client";
import type { FeedItem } from "@iedc/shared/protocol";
import { cx } from "@/lib/format";

const MARK: Record<FeedItem["kind"], string> = {
  firstblood: "var(--color-stamp)",
  solve: "var(--color-mint)",
  streak: "var(--color-coral)",
  join: "var(--color-sky)",
  info: "var(--color-yellow)",
  cheat: "var(--color-stamp)",
  out: "var(--color-pencil)",
};

export function Feed({ items, max = 5, big }: { items: FeedItem[]; max?: number; big?: boolean }) {
  const shown = items.slice(-max).reverse();
  return (
    <ul className={cx("flex flex-col gap-1.5", big ? "text-lg" : "text-sm")}>
        {shown.map((f) => (
          <li key={f.id} className="flex animate-pop items-start gap-2">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rotate-45 border-2 border-ink" style={{ background: MARK[f.kind] }} />
            <span className={cx(f.kind === "firstblood" && "font-bold")}>{f.text}</span>
          </li>
        ))}
    </ul>
  );
}
