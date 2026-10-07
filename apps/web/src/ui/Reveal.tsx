import type { Reveal as RevealT } from "@iedc/shared/games/types";
import { cx } from "@/lib/format";

/** "The answer was…" — shown on every device after a round. */
export function Reveal({ reveal, big }: { reveal: RevealT; big?: boolean }) {
  if (reveal.kind === "words") {
    return (
      <div className="flex flex-wrap justify-center gap-2">
        {reveal.words.map((w) => (
          <span key={w} className={cx("chip !bg-yellow uppercase tracking-wider", big ? "!px-4 !py-1.5 text-2xl" : "text-base")}>
            {w}
          </span>
        ))}
      </div>
    );
  }
  if (reveal.kind === "expression") {
    return (
      <div className={cx("text-center font-black", big ? "text-4xl" : "text-xl")}>
        <span className="hl">{reveal.target}</span> = <span className="hand font-normal">{reveal.expression}</span>
      </div>
    );
  }
  const { size, boxR, boxC, grid, givens } = reveal;
  const cell = big ? "h-10 w-10 text-2xl" : "h-7 w-7 text-base";
  return (
    <div className="mx-auto inline-grid border-[3px] border-ink bg-card" style={{ gridTemplateColumns: `repeat(${size}, auto)` }}>
      {grid.map((v, i) => {
        const r = Math.floor(i / size);
        const c = i % size;
        return (
          <span
            key={i}
            className={cx("grid place-items-center border-ink/30", cell, givens[i] ? "font-black" : "hand text-coral")}
            style={{
              borderRightWidth: (c + 1) % boxC === 0 && c < size - 1 ? 2.5 : 1,
              borderBottomWidth: (r + 1) % boxR === 0 && r < size - 1 ? 2.5 : 1,
              borderColor: (c + 1) % boxC === 0 || (r + 1) % boxR === 0 ? "var(--color-ink)" : undefined,
            }}
          >
            {v}
          </span>
        );
      })}
    </div>
  );
}
