"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SudokuProgress, SudokuPub } from "@iedc/shared/games/sudoku/engine";
import { conflicts } from "@iedc/shared/games/sudoku/grid";
import { cx } from "@/lib/format";
import { sfx } from "@/ui/sfx";
import type { ViewProps } from "./types";
import { gameText as G } from "@iedc/data/copy/games";

export default function SudokuView({ pub, progress, done, frozen, submit }: ViewProps<SudokuPub, SudokuProgress>) {
  const { size, boxR, boxC, givens } = pub;
  const [grid, setGrid] = useState<number[]>(() => progress?.grid?.length === givens.length ? progress.grid : givens.slice());
  const [notes, setNotes] = useState<Record<number, number[]>>({});
  const [sel, setSel] = useState<number>(() => givens.findIndex((v) => v === 0));
  const [noteMode, setNoteMode] = useState(false);
  const [history, setHistory] = useState<number[][]>([]);
  const [shake, setShake] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFinal = useRef<string>("");

  const clash = useMemo(() => conflicts(grid, size, boxR, boxC), [grid, size, boxR, boxC]);
  const locked = done || frozen;

  const push = useCallback(
    async (g: number[]) => {
      const full = g.every((v) => v > 0);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (!full) {
        saveTimer.current = setTimeout(() => void submit({ grid: g, final: false }).catch(() => {}), 900);
        return;
      }
      const key = g.join("");
      if (key === lastFinal.current) return;
      lastFinal.current = key;
      try {
        const res = await submit({ grid: g, final: true });
        if (res.status === "wrong") {
          setShake((n) => n + 1);
          setMsg(res.message ?? G.sudoku.notQuite);
        } else if (!res.ok && res.error) setMsg(res.error);
      } catch {
        setMsg(G.lostConnection);
        lastFinal.current = "";
      }
    },
    [submit],
  );

  useEffect(() => () => void (saveTimer.current && clearTimeout(saveTimer.current)), []);

  const place = useCallback(
    (v: number) => {
      if (locked || sel < 0 || givens[sel]) return;
      sfx.tap();
      if (noteMode && v > 0) {
        setNotes((n) => {
          const cur = n[sel] ?? [];
          return { ...n, [sel]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v].sort() };
        });
        return;
      }
      setMsg(null);
      setHistory((h) => [...h.slice(-40), grid]);
      const g = grid.slice();
      g[sel] = g[sel] === v ? 0 : v;
      setGrid(g);
      if (v) {
        // a placed digit clears that digit from peers' pencil marks
        setNotes((n) => {
          const next = { ...n };
          delete next[sel];
          return next;
        });
      }
      void push(g);
    },
    [locked, sel, givens, noteMode, grid, push],
  );

  const undo = () => {
    if (locked || !history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setGrid(prev);
    void push(prev);
  };

  // physical keyboard on laptops
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (locked) return;
      const n = Number(e.key);
      if (n >= 1 && n <= size) return place(n);
      if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") return place(0);
      const moves: Record<string, number> = { ArrowUp: -size, ArrowDown: size, ArrowLeft: -1, ArrowRight: 1 };
      if (moves[e.key] !== undefined) {
        e.preventDefault();
        setSel((s) => Math.min(size * size - 1, Math.max(0, (s < 0 ? 0 : s) + moves[e.key])));
      }
      if (e.key === "n") setNoteMode((m) => !m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, size, place]);

  const selVal = sel >= 0 ? grid[sel] : 0;
  const selR = Math.floor(sel / size);
  const selC = sel % size;
  const inBox = (i: number) =>
    Math.floor(Math.floor(i / size) / boxR) === Math.floor(selR / boxR) && Math.floor((i % size) / boxC) === Math.floor(selC / boxC);
  const counts = useMemo(() => {
    const c = new Array(size + 1).fill(0);
    for (const v of grid) c[v]++;
    return c;
  }, [grid, size]);

  return (
    <div className="no-copy mx-auto flex w-full max-w-md flex-col items-center gap-4">
      <div
        key={shake}
        className={cx("grid w-full border-[3px] border-ink bg-card shadow-[4px_4px_0_0_var(--color-ink)]", shake > 0 && "animate-wiggle")}
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, maxWidth: size === 9 ? 420 : 360 }}
      >
        {grid.map((v, i) => {
          const r = Math.floor(i / size);
          const c = i % size;
          const given = givens[i] > 0;
          const related = sel >= 0 && (r === selR || c === selC || inBox(i));
          const same = selVal > 0 && v === selVal;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSel(i)}
              disabled={locked}
              className={cx(
                "relative grid aspect-square place-items-center leading-none transition-colors",
                size === 9 ? "text-[clamp(1.05rem,5.2vw,1.6rem)]" : "text-[clamp(1.4rem,7vw,2rem)]",
                given ? "font-black" : "hand text-[#2a5bd7]",
                related && "bg-yellow/25",
                same && "bg-yellow/70",
                i === sel && "!bg-yellow",
                clash.has(i) && !given && "!text-stamp",
                clash.has(i) && "bg-coral/25",
              )}
              style={{
                borderRight: c < size - 1 ? `${(c + 1) % boxC === 0 ? 2.5 : 1}px solid ${(c + 1) % boxC === 0 ? "#1d1b16" : "#1d1b1633"}` : undefined,
                borderBottom: r < size - 1 ? `${(r + 1) % boxR === 0 ? 2.5 : 1}px solid ${(r + 1) % boxR === 0 ? "#1d1b16" : "#1d1b1633"}` : undefined,
              }}
              aria-label={G.sudoku.cellLabel(r + 1, c + 1, v)}
            >
              {v > 0 ? (
                v
              ) : notes[i]?.length ? (
                <span className={cx("hand grid w-full p-0.5 text-pencil", size === 9 ? "grid-cols-3 text-[0.55rem]" : "grid-cols-3 text-[0.7rem]")}>
                  {Array.from({ length: size }, (_, k) => (
                    <span key={k} className="text-center leading-tight">
                      {notes[i].includes(k + 1) ? k + 1 : ""}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {msg && <p className="hand -my-1 text-lg text-stamp">{msg}</p>}

      <div className="grid w-full gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(size, 9)}, 1fr)` }}>
        {Array.from({ length: size }, (_, k) => k + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={locked || counts[n] >= size}
            onClick={() => place(n)}
            className="sticker !rounded-xl !px-0 !py-2.5 text-2xl"
            style={{ background: noteMode ? "var(--color-card)" : "var(--color-mint)" }}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex w-full gap-2">
        <button type="button" disabled={locked} onClick={() => place(0)} className="sticker flex-1 !bg-card">
          {G.sudoku.eraseButton}
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => setNoteMode((m) => !m)}
          className="sticker flex-1"
          data-pressed={noteMode}
          style={{ background: noteMode ? "var(--color-yellow)" : "var(--color-card)" }}
        >
          {noteMode ? G.sudoku.pencilOnButton : G.sudoku.pencilButton}
        </button>
        <button type="button" disabled={locked || !history.length} onClick={undo} className="sticker flex-1 !bg-card">
          {G.sudoku.undoButton}
        </button>
      </div>
    </div>
  );
}
