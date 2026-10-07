"use client";
import { useLayoutEffect, useRef } from "react";

/**
 * Minimal FLIP list animation: children with `data-flip="<key>"` glide to their
 * new position when the order changes (leaderboard shuffles). ~1 KB instead of
 * a 40 KB animation library on every phone.
 */
export function useFlip<T extends HTMLElement>(deps: unknown) {
  const ref = useRef<T>(null);
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const next = new Map<string, number>();
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-flip]"));
    for (const el of nodes) next.set(el.dataset.flip!, el.getBoundingClientRect().top);
    for (const el of nodes) {
      const before = last.current.get(el.dataset.flip!);
      const after = next.get(el.dataset.flip!)!;
      if (before === undefined) {
        el.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "ease-out" });
      } else if (Math.abs(before - after) > 1) {
        el.animate([{ transform: `translateY(${before - after}px)` }, { transform: "none" }], {
          duration: 450,
          easing: "cubic-bezier(.2,1.2,.4,1)",
        });
      }
    }
    last.current = next;
  }, [deps]);
  return ref;
}
