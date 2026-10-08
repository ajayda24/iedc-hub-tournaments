"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AnagramProgress, AnagramPub } from "@iedc/shared/games/anagram/engine";
import { cx } from "@/lib/format";
import { sfx } from "@/ui/sfx";
import type { ViewProps } from "./types";
import { gameText as G } from "@iedc/data/copy/games";

export default function AnagramView({ pub, progress, done, frozen, submit }: ViewProps<AnagramPub, AnagramProgress>) {
  const [answers, setAnswers] = useState<(string | null)[]>(progress?.answers ?? pub.scrambles.map(() => null));
  const [cur, setCur] = useState(() => Math.max(0, answers.findIndex((a) => !a)));
  /** indexes into the scramble's letters, in the order tapped */
  const [picked, setPicked] = useState<number[]>([]);
  const [shake, setShake] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = done || frozen;

  useEffect(() => {
    if (progress?.answers && progress.answers.filter(Boolean).length > answers.filter(Boolean).length) setAnswers(progress.answers);
  }, [progress, answers]);

  const letters = useMemo(() => [...(pub.scrambles[cur] ?? "")], [pub.scrambles, cur]);
  const word = picked.map((i) => letters[i]).join("");

  const nextOpen = useCallback(
    (from: number, list = answers) => {
      for (let k = 1; k <= list.length; k++) {
        const i = (from + k) % list.length;
        if (!list[i]) return i;
      }
      return from;
    },
    [answers],
  );

  const go = (i: number) => {
    if (answers[i]) return;
    setCur(i);
    setPicked([]);
    setMsg(null);
  };

  const check = useCallback(
    async (guess: string) => {
      setBusy(true);
      try {
        const res = await submit({ index: cur, answer: guess.toLowerCase() });
        if (res.ok && (res.status === "progress" || res.status === "solved")) {
          const p = res.progress as AnagramProgress;
          setAnswers(p.answers);
          setPicked([]);
          setMsg(null);
          if (res.status !== "solved") setCur(nextOpen(cur, p.answers));
        } else {
          setShake((n) => n + 1);
          setMsg(res.message ?? res.error ?? G.anagram.nope);
          setTimeout(() => setPicked([]), 450);
        }
      } catch {
        setMsg(G.lostConnection);
      } finally {
        setBusy(false);
      }
    },
    [submit, cur, nextOpen],
  );

  const tap = (i: number) => {
    if (locked || busy || picked.includes(i)) return;
    sfx.tap();
    const next = [...picked, i];
    setPicked(next);
    setMsg(null);
    if (next.length === letters.length) void check(next.map((x) => letters[x]).join(""));
  };
  const unpick = () => !locked && !busy && setPicked((p) => p.slice(0, -1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (locked || busy) return;
      if (e.key === "Backspace") return unpick();
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        return go(nextOpen(cur));
      }
      const ch = e.key.toUpperCase();
      if (!/^[A-Z]$/.test(ch)) return;
      const i = letters.findIndex((l, k) => l === ch && !picked.includes(k));
      if (i >= 0) tap(i);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const solvedCount = answers.filter(Boolean).length;
  const allDone = solvedCount === answers.length;

  return (
    <div className="no-copy mx-auto flex w-full max-w-md flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between">
        <span className="chip !bg-coral">{pub.packTitle}</span>
        <span className="font-black tabular-nums">
          {solvedCount}/{answers.length}
        </span>
      </div>

      {/* progress dots: tap to jump */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {pub.scrambles.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            disabled={locked || !!answers[i]}
            className={cx(
              "rounded-md border-2 border-ink px-2 py-1 text-xs font-bold uppercase transition-transform",
              answers[i] ? "bg-mint" : i === cur ? "-translate-y-0.5 bg-yellow shadow-[2px_2px_0_0_var(--color-ink)]" : "bg-card",
            )}
          >
            {answers[i] ?? s}
          </button>
        ))}
      </div>

      {allDone ? (
        <p className="hand py-6 text-2xl">{G.anagram.allDone}</p>
      ) : (
        <>
          {/* answer slots */}
          <button
            type="button"
            onClick={unpick}
            key={shake}
            className={cx("flex min-h-[4rem] flex-wrap justify-center gap-1.5", shake > 0 && "animate-wiggle")}
            aria-label={G.anagram.removeLetterLabel}
          >
            {letters.map((_, i) => (
              <span
                key={i}
                className={cx(
                  "grid h-[clamp(2.4rem,11vw,3.2rem)] w-[clamp(2.4rem,11vw,3.2rem)] place-items-center border-b-[3px] border-ink text-[clamp(1.4rem,7vw,2rem)] font-black",
                  word[i] && "animate-pop",
                )}
              >
                {word[i] ?? ""}
              </span>
            ))}
          </button>

          {/* scrambled tiles */}
          <div className="flex flex-wrap justify-center gap-2">
            {letters.map((l, i) => (
              <button
                key={`${cur}-${i}`}
                type="button"
                disabled={locked || busy}
                onClick={() => tap(i)}
                className={cx(
                  "sticker !rounded-lg !px-0 !py-0 h-[clamp(2.8rem,13vw,3.6rem)] w-[clamp(2.8rem,13vw,3.6rem)] text-[clamp(1.4rem,7vw,2rem)]",
                  picked.includes(i) && "pointer-events-none opacity-20",
                )}
                style={{ background: "var(--color-card)", transform: `rotate(${((i * 37) % 9) - 4}deg)` }}
              >
                {l}
              </button>
            ))}
          </div>

          <p className="hand h-6 text-lg text-stamp">{msg}</p>

          <div className="flex w-full gap-2">
            <button type="button" disabled={locked || !picked.length} onClick={() => setPicked([])} className="sticker flex-1 !bg-card">
              {G.anagram.clearButton}
            </button>
            <button type="button" disabled={locked || solvedCount >= answers.length - 1} onClick={() => go(nextOpen(cur))} className="sticker flex-1 !bg-card">
              {G.anagram.skipButton}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
