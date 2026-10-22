"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QueensProgress, QueensPub } from "@iedc/shared/games/queens/engine";
import { queenConflicts } from "@iedc/shared/games/queens/engine";
import { cx } from "@/lib/format";
import { sfx } from "@/ui/sfx";
import type { ViewProps } from "./types";
import { gameText as G } from "@iedc/data/copy/games";

/** cell state on the phone: 0 empty, 1 my ✕ note, 2 queen */
type Mark = 0 | 1 | 2;

export default function QueensView({ pub, progress, done, frozen, submit }: ViewProps<QueensPub, QueensProgress>) {
  const { size, givens, blocked } = pub;
  const n = size * size;
  const givenSet = useMemo(() => new Set(givens), [givens]);
  const blockedSet = useMemo(() => new Set(blocked), [blocked]);
  const [marks, setMarks] = useState<Mark[]>(() => {
    const m = new Array<Mark>(n).fill(0);
    for (const q of progress?.queens ?? givens) m[q] = 2;
    return m;
  });
  const [history, setHistory] = useState<Mark[][]>([]);
  const [shake, setShake] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFinal = useRef<string>("");

  const queens = useMemo(() => marks.flatMap((m, i) => (m === 2 ? [i] : [])), [marks]);
  const clash = useMemo(() => queenConflicts(queens, size), [queens, size]);
  const locked = done || frozen;

  const push = useCallback(
    async (q: number[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // only a full, clash-free board is worth checking; anything else just autosaves
      if (q.length !== size || queenConflicts(q, size).size) {
        saveTimer.current = setTimeout(() => void submit({ queens: q, final: false }).catch(() => {}), 900);
        return;
      }
      const key = q.join(",");
      if (key === lastFinal.current) return;
      lastFinal.current = key;
      try {
        const res = await submit({ queens: q, final: true });
        if (res.status === "wrong") {
          setShake((s) => s + 1);
          setMsg(res.message ?? G.queens.notQuite);
        } else if (!res.ok && res.error) setMsg(res.error);
      } catch {
        setMsg(G.lostConnection);
        lastFinal.current = "";
      }
    },
    [size, submit],
  );

  useEffect(() => () => void (saveTimer.current && clearTimeout(saveTimer.current)), []);

  const tap = (i: number) => {
    if (locked || givenSet.has(i) || blockedSet.has(i)) return;
    sfx.tap();
    setMsg(null);
    setHistory((h) => [...h.slice(-60), marks]);
    const next = marks.slice();
    next[i] = ((marks[i] + 1) % 3) as Mark;
    setMarks(next);
    // ✕ notes are private; only queen changes go to the server
    if (marks[i] === 2 || next[i] === 2) void push(next.flatMap((m, k) => (m === 2 ? [k] : [])));
  };

  const restore = (m: Mark[]) => {
    setMarks(m);
    void push(m.flatMap((v, k) => (v === 2 ? [k] : [])));
  };

  const undo = () => {
    if (locked || !history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    restore(prev);
  };

  const clear = () => {
    if (locked) return;
    setHistory((h) => [...h.slice(-60), marks]);
    restore(marks.map((_, i) => (givenSet.has(i) ? 2 : 0)) as Mark[]);
  };

  const cellText = size >= 10 ? "text-[clamp(1rem,5vw,1.5rem)]" : size >= 8 ? "text-[clamp(1.2rem,6vw,1.8rem)]" : "text-[clamp(1.5rem,8vw,2.2rem)]";

  return (
    <div className="no-copy mx-auto flex w-full max-w-md flex-col items-center gap-4">
      <div
        key={shake}
        className={cx("grid w-full border-[3px] border-ink bg-card shadow-[4px_4px_0_0_var(--color-ink)]", shake > 0 && "animate-wiggle")}
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, maxWidth: size >= 10 ? 440 : 400 }}
      >
        {marks.map((m, i) => {
          const r = Math.floor(i / size);
          const c = i % size;
          const given = givenSet.has(i);
          const block = blockedSet.has(i);
          const dark = (r + c) % 2 === 1;
          return (
            <button
              key={i}
              type="button"
              onClick={() => tap(i)}
              disabled={locked || given || block}
              className={cx(
                "relative grid aspect-square place-items-center leading-none transition-colors",
                cellText,
                dark ? "bg-paper-2" : "bg-card",
                block && "!bg-ink/15 text-ink/60",
                clash.has(i) && "!bg-coral/35",
              )}
              style={{
                borderRight: c < size - 1 ? "1px solid #1d1b1633" : undefined,
                borderBottom: r < size - 1 ? "1px solid #1d1b1633" : undefined,
              }}
              aria-label={G.queens.cellLabel(r + 1, c + 1, block ? "blocked" : m === 2 ? "queen" : m === 1 ? "marked" : "empty")}
            >
              {block ? (
                <span className="font-black">✕</span>
              ) : m === 2 ? (
                <span className={cx("text-[1.3em]", given ? "text-ink" : "text-[#2a5bd7]", clash.has(i) && "!text-stamp", "animate-pop")}>♛</span>
              ) : m === 1 ? (
                <span className="hand text-pencil">×</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className={cx("hand -my-1 text-lg", msg ? "text-stamp" : "text-pencil")}>{msg ?? G.queens.placed(queens.length, size)}</p>

      <div className="flex w-full gap-2">
        <button type="button" disabled={locked} onClick={clear} className="sticker flex-1 !bg-card">
          {G.queens.clearButton}
        </button>
        <button type="button" disabled={locked || !history.length} onClick={undo} className="sticker flex-1 !bg-card">
          {G.queens.undoButton}
        </button>
      </div>
    </div>
  );
}
