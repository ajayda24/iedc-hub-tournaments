"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GAME_META, GAME_ORDER } from "@iedc/shared/games/meta";
import { isArenaOrigin } from "@/lib/arena";
import { store } from "@/lib/storage";
import { Btn, COLOR, DoodleArrow, Hand, Slip, Squiggle, Star } from "@/ui/kit";
import { Mascot } from "@/ui/Mascot";

const TILTS = [-2, 1.5, -1, 2];

export function Landing() {
  const [onLan, setOnLan] = useState(false);
  const [addr, setAddr] = useState("192.168.137.1");
  useEffect(() => {
    setOnLan(isArenaOrigin());
    setAddr(store.get("ba:lastArena", "192.168.137.1"));
  }, []);

  const go = () => {
    const host = addr.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!host) return;
    store.set("ba:lastArena", host);
    window.location.href = `http://${host.includes(":") ? host : `${host}:4000`}/play/`;
  };

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-5 pb-16 pt-6 md:pl-20">
      <nav className="flex items-center gap-3">
        <span className="text-2xl font-black tracking-tight">
          Brain<span className="text-coral">/</span>Arena
        </span>
        <span className="chip -rotate-3 !bg-sky text-xs">by IEDC</span>
        {onLan && (
          <Link href="/host/" className="ml-auto text-sm font-bold underline decoration-2 underline-offset-4">
            host console
          </Link>
        )}
      </nav>

      <section className="grid items-center gap-8 md:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-5">
          <h1 className="text-[clamp(2.6rem,9vw,5rem)] font-black leading-[0.95] tracking-tight">
            Logic games.
            <br />
            <span className="hl">Live.</span> Loud.
            <br />
            Zero Wi-Fi drama.
          </h1>
          <p className="max-w-md text-lg font-medium text-ink-soft">
            The host taps start, the whole room gets the same puzzle at the same second, and the leaderboard does the trash talk.
          </p>
          {onLan ? (
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/play/" className="sticker !bg-mint !px-7 !py-4 text-xl">
                Join the live event →
              </Link>
              <Hand className="text-lg">you&apos;re on the event Wi-Fi</Hand>
            </div>
          ) : (
            <Slip taped className="flex max-w-md flex-col gap-3 px-4 pb-4 pt-6" tilt={-1}>
              <span className="font-black">At an event?</span>
              <ol className="list-decimal space-y-0.5 pl-5 text-sm font-medium">
                <li>Join the event Wi-Fi (the host&apos;s hotspot)</li>
                <li>Turn off mobile data</li>
                <li>Scan the QR on the big screen — or type the address:</li>
              </ol>
              <div className="flex gap-2">
                <input className="field !py-2 font-mono" value={addr} onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} />
                <Btn tone="mint" onClick={go}>
                  Go
                </Btn>
              </div>
            </Slip>
          )}
        </div>
        <div className="relative mx-auto">
          <Mascot mood="happy" size={210} />
          <Hand className="absolute -left-24 top-6 hidden -rotate-6 text-xl md:block">this is Bulbu</Hand>
          <DoodleArrow className="absolute -left-14 top-12 hidden w-14 rotate-12 text-pencil md:block" />
          <Star className="absolute -right-4 top-0 h-8 w-8 rotate-12 text-yellow" />
          <Star className="absolute -left-2 bottom-16 h-5 w-5 -rotate-12 text-coral" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end gap-3">
          <h2 className="text-3xl font-black">Warm up solo</h2>
          <Squiggle className="mb-2 h-3 w-24 text-coral" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {GAME_ORDER.map((g, i) => {
            const m = GAME_META[g];
            return (
              <Link
                key={g}
                href={`/practice/?game=${g}`}
                className="slip block px-4 pb-4 pt-5 transition-transform hover:-translate-y-1"
                style={{ background: COLOR[m.color], transform: `rotate(${TILTS[i]}deg)` }}
              >
                <div className="text-xl font-black">{m.title}</div>
                <Hand className="!text-ink text-base leading-snug">{m.tagline}</Hand>
                <div className="mt-3 text-sm font-bold underline decoration-2 underline-offset-4">practice →</div>
              </Link>
            );
          })}
        </div>
        <Hand className="text-base">Practice works offline once this site is installed (Add to Home Screen).</Hand>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {[
          ["Same puzzle, same second", "Everyone's clock is synced to the host laptop. Fastest correct answer wins the most."],
          ["No internet. On purpose.", "The event runs on a hotspot with no internet. Phones caught online get frozen. Sorry, ChatGPT."],
          ["Department wars", "Every point counts for your department too. CSE vs Mech, settle it here."],
        ].map(([t, b], i) => (
          <div key={t} className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-ink font-black" style={{ background: [COLOR.yellow, COLOR.mint, COLOR.coral][i] }}>
              {i + 1}
            </span>
            <div>
              <div className="font-black">{t}</div>
              <p className="text-sm font-medium text-ink-soft">{b}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
