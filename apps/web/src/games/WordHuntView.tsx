"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Tile, WordHuntProgress, WordHuntPub } from "@iedc/shared/games/wordhunt/engine";
import { cx } from "@/lib/format";
import { sfx } from "@/ui/sfx";
import type { ViewProps } from "./types";
import { gameText as G } from "@iedc/data/copy/games";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const TILE_BG: Record<Tile, string> = { g: "var(--color-mint)", y: "var(--color-yellow)", x: "#d8d1c2" };
const RANK: Record<Tile, number> = { x: 1, y: 2, g: 3 };

export default function WordHuntView({ pub, progress, done, frozen, submit }: ViewProps<WordHuntPub, WordHuntProgress>) {
  const [guesses, setGuesses] = useState(progress?.guesses ?? []);
  const [typing, setTyping] = useState("");
  const [shake, setShake] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = done || frozen || busy || guesses.length >= pub.maxGuesses;

  useEffect(() => {
    if (progress?.guesses && progress.guesses.length > guesses.length) setGuesses(progress.guesses);
  }, [progress, guesses.length]);

  const keyState = useMemo(() => {
    const m: Record<string, Tile> = {};
    for (const g of guesses) {
      [...g.word].forEach((ch, i) => {
        const t = g.tiles[i];
        if (!m[ch] || RANK[t] > RANK[m[ch]]) m[ch] = t;
      });
    }
    return m;
  }, [guesses]);

  const enter = useCallback(async () => {
    if (locked) return;
    if (typing.length !== pub.length) {
      setShake((n) => n + 1);
      setMsg(G.wordhunt.needsLetters(pub.length));
      return;
    }
    setBusy(true);
    try {
      const res = await submit({ guess: typing });
      if (res.ok && res.progress) {
        const p = res.progress as WordHuntProgress;
        if (res.status === "invalid") {
          setShake((n) => n + 1);
          setMsg(res.message ?? G.wordhunt.notAWord);
        } else {
          setGuesses(p.guesses);
          setTyping("");
          setMsg(res.status === "failed" ? G.wordhunt.outOfGuesses : null);
        }
      } else {
        setShake((n) => n + 1);
        setMsg(res.message ?? res.error ?? G.wordhunt.hmm);
      }
    } catch {
      setMsg(G.lostConnection);
    } finally {
      setBusy(false);
    }
  }, [locked, typing, pub.length, submit]);

  const press = useCallback(
    (k: string) => {
      if (locked) return;
      if (k === "enter") return void enter();
      sfx.tap();
      setMsg(null);
      if (k === "back") return setTyping((t) => t.slice(0, -1));
      setTyping((t) => (t.length < pub.length ? t + k : t));
    },
    [locked, enter, pub.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") press("enter");
      else if (e.key === "Backspace") press("back");
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const rows = Array.from({ length: pub.maxGuesses }, (_, r) => {
    if (r < guesses.length) return { word: guesses[r].word, tiles: guesses[r].tiles as (Tile | null)[], current: false };
    if (r === guesses.length) return { word: typing, tiles: [] as (Tile | null)[], current: true };
    return { word: "", tiles: [] as (Tile | null)[], current: false };
  });

  return (
    <div className="no-copy mx-auto flex w-full max-w-md flex-col items-center gap-3">
      <div className="flex flex-col gap-1.5">
        {rows.map((row, r) => (
          <div key={`${r}-${row.current ? shake : 0}`} className={cx("flex gap-1.5", row.current && shake > 0 && "animate-wiggle")}>
            {Array.from({ length: pub.length }, (_, i) => {
              const ch = row.word[i] ?? "";
              const t = row.tiles[i];
              return (
                <span
                  key={i}
                  className={cx(
                    "grid h-[clamp(2.6rem,13vw,3.4rem)] w-[clamp(2.6rem,13vw,3.4rem)] place-items-center rounded-md border-[2.5px] border-ink text-[clamp(1.4rem,7vw,1.9rem)] font-black uppercase",
                    t && "tile-flip",
                    !t && ch && "animate-pop",
                  )}
                  style={{
                    background: t ? TILE_BG[t] : "var(--color-card)",
                    animationDelay: t ? `${i * 90}ms` : undefined,
                    boxShadow: ch && !t ? "2px 2px 0 0 #1d1b16" : undefined,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <p className="hand h-6 text-lg text-stamp">{msg}</p>

      <div className="flex w-full flex-col gap-1.5">
        {ROWS.map((row, ri) => (
          <div key={row} className="flex justify-center gap-1">
            {ri === 2 && (
              <button type="button" disabled={locked} onClick={() => press("enter")} className="sticker !rounded-lg !px-2 !py-3 text-xs !shadow-[2px_2px_0_0_var(--color-ink)]">
                {G.wordhunt.enterKey}
              </button>
            )}
            {[...row].map((k) => (
              <button
                key={k}
                type="button"
                disabled={locked}
                onClick={() => press(k)}
                className="sticker min-w-0 flex-1 !rounded-lg !px-0 !py-3 text-base uppercase !shadow-[2px_2px_0_0_var(--color-ink)]"
                style={{ background: keyState[k] ? TILE_BG[keyState[k]] : "var(--color-card)", maxWidth: 40 }}
              >
                {k}
              </button>
            ))}
            {ri === 2 && (
              <button type="button" disabled={locked} onClick={() => press("back")} className="sticker !rounded-lg !bg-card !px-2 !py-3 text-xs !shadow-[2px_2px_0_0_var(--color-ink)]" aria-label={G.wordhunt.backspaceLabel}>
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
