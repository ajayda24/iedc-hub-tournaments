"use client";
import { useCallback, useEffect, useState } from "react";
import type { CrunchProgress, CrunchPub } from "@iedc/shared/games/numbercrunch/engine";
import { cx } from "@/lib/format";
import { sfx } from "@/ui/sfx";
import type { ViewProps } from "./types";
import { gameText as G } from "@iedc/data/copy/games";

type Op = "+" | "-" | "×" | "÷";
interface NumTile {
  id: number;
  value: number;
  expr: string;
  made: boolean;
}
interface Step {
  a: NumTile;
  b: NumTile;
  op: Op;
  out: NumTile;
}

function apply(a: number, op: Op, b: number): number | string {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b > 0 ? a - b : G.numbercrunch.noNegatives;
    case "×":
      return a * b;
    case "÷":
      return b !== 0 && a % b === 0 ? a / b : G.numbercrunch.divideEvenly;
  }
}

export default function NumberCrunchView({ pub, progress, done, frozen, submit }: ViewProps<CrunchPub, CrunchProgress>) {
  const initial = useCallback(() => pub.numbers.map((v, i) => ({ id: i, value: v, expr: String(v), made: false })), [pub.numbers]);
  const [tiles, setTiles] = useState<NumTile[]>(initial);
  const [steps, setSteps] = useState<Step[]>([]);
  const [first, setFirst] = useState<NumTile | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [best, setBest] = useState(progress?.best ?? null);
  const [msg, setMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const locked = done || frozen || busy;
  const [nextId, setNextId] = useState(100);

  useEffect(() => {
    if (progress?.best) setBest(progress.best);
  }, [progress]);

  const send = useCallback(
    async (t: NumTile) => {
      setBusy(true);
      try {
        const res = await submit({ expr: t.expr });
        const p = res.progress as CrunchProgress | undefined;
        if (p?.best) setBest(p.best);
        if (res.status === "solved") setMsg(null);
        else {
          setMsg(res.message ?? res.error ?? G.wordhunt.hmm);
          if (res.status === "invalid" || !res.ok) setShake((n) => n + 1);
        }
      } catch {
        setMsg(G.lostConnection);
      } finally {
        setBusy(false);
      }
    },
    [submit],
  );

  const pickTile = (t: NumTile) => {
    if (locked) return;
    sfx.tap();
    setMsg(null);
    if (!first || !op) {
      setFirst(first?.id === t.id ? null : t);
      setOp(null);
      return;
    }
    if (t.id === first.id) return;
    const result = apply(first.value, op, t.value);
    if (typeof result === "string") {
      setMsg(result);
      setShake((n) => n + 1);
      setOp(null);
      return;
    }
    const out: NumTile = { id: nextId, value: result, expr: `(${first.expr} ${op} ${t.expr})`, made: true };
    setNextId((n) => n + 1);
    setSteps((s) => [...s, { a: first, b: t, op, out }]);
    setTiles((ts) => [...ts.filter((x) => x.id !== first.id && x.id !== t.id), out]);
    setFirst(null);
    setOp(null);
    if (result === pub.target) {
      sfx.pop();
      void send(out);
    }
  };

  const undo = () => {
    const last = steps[steps.length - 1];
    if (!last || locked) return;
    setSteps((s) => s.slice(0, -1));
    setTiles((ts) => [...ts.filter((x) => x.id !== last.out.id), last.a, last.b].sort((x, y) => x.id - y.id));
    setFirst(null);
    setOp(null);
  };
  const reset = () => {
    if (locked) return;
    setTiles(initial());
    setSteps([]);
    setFirst(null);
    setOp(null);
    setMsg(null);
  };

  // the tile you'd submit: the one selected, else the closest to the target
  const candidate =
    first ?? tiles.reduce<NumTile | null>((b, t) => (!b || Math.abs(t.value - pub.target) < Math.abs(b.value - pub.target) ? t : b), null);

  return (
    <div className="no-copy mx-auto flex w-full max-w-md flex-col items-center gap-4">
      <div className="slip taped flex flex-col items-center px-8 pb-3 pt-4" style={{ background: "var(--color-sky)", transform: "rotate(-1.5deg)" }}>
        <span className="hand text-lg">{G.numbercrunch.makeThis}</span>
        <span className="text-6xl font-black tabular-nums">{pub.target}</span>
      </div>

      <div key={shake} className={cx("flex flex-wrap justify-center gap-2.5", shake > 0 && "animate-wiggle")}>
        {tiles.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={locked}
            onClick={() => pickTile(t)}
            data-pressed={first?.id === t.id}
            className={cx("sticker animate-pop !px-0 h-16 min-w-16 text-2xl tabular-nums", t.value >= 100 && "!px-2")}
            style={{ background: first?.id === t.id ? "var(--color-yellow)" : t.made ? "var(--color-mint)" : "var(--color-card)" }}
          >
            {t.value}
          </button>
        ))}
      </div>

      <div className="grid w-full grid-cols-4 gap-2">
        {(["+", "-", "×", "÷"] as Op[]).map((o) => (
          <button
            key={o}
            type="button"
            disabled={locked || !first}
            onClick={() => {
              sfx.tap();
              setOp(op === o ? null : o);
            }}
            data-pressed={op === o}
            className="sticker !py-3 text-3xl"
            style={{ background: op === o ? "var(--color-coral)" : "var(--color-card)" }}
          >
            {o === "-" ? "−" : o}
          </button>
        ))}
      </div>

      <p className="hand h-6 text-center text-lg">
        {msg ? <span className="text-stamp">{msg}</span> : !first ? G.numbercrunch.tapNumber : !op ? G.numbercrunch.tapOperation : G.numbercrunch.tapAnother}
      </p>

      {steps.length > 0 && (
        <ol className="hand w-full rounded-lg border-2 border-dashed border-pencil bg-card/70 px-3 py-2 text-lg">
          {steps.map((s, i) => (
            <li key={i}>
              {s.a.value} {s.op} {s.b.value} = <b className="font-display">{s.out.value}</b>
            </li>
          ))}
        </ol>
      )}

      <div className="flex w-full gap-2">
        <button type="button" disabled={locked || !steps.length} onClick={undo} className="sticker flex-1 !bg-card">
          {G.numbercrunch.undoButton}
        </button>
        <button type="button" disabled={locked} onClick={reset} className="sticker flex-1 !bg-card">
          {G.numbercrunch.resetButton}
        </button>
        <button type="button" disabled={locked || !candidate} onClick={() => candidate && send(candidate)} className="sticker flex-[1.4]" style={{ background: "var(--color-mint)" }}>
          {G.numbercrunch.submitButton(candidate?.value ?? "")}
        </button>
      </div>
      {best && (
        <p className="text-sm text-pencil">
          {G.numbercrunch.closest} <b className="text-ink">{best.value}</b> {G.numbercrunch.away(Math.abs(best.value - pub.target))}
        </p>
      )}
    </div>
  );
}
