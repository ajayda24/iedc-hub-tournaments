"use client";
import { useEffect, useRef, useState } from "react";
import { GAME_META } from "@iedc/shared/games/meta";
import type { PublicState } from "@iedc/shared/protocol";
import { connectArena, useArena } from "@/net/arena";
import { useServerNow } from "@/net/useNow";
import { cx, fmtSecs } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Confetti } from "@/ui/Confetti";
import { Feed } from "@/ui/Feed";
import { COLOR, ConnDot, Hand, Slip } from "@/ui/kit";
import { DeptBoard, Leaderboard } from "@/ui/Leaderboard";
import { Mascot } from "@/ui/Mascot";
import { Podium } from "@/ui/Podium";
import { Reveal } from "@/ui/Reveal";
import { setSound, sfx, soundOn } from "@/ui/sfx";
import { TimerBar } from "@/ui/Timer";

/** The projector view. Big type, no controls, everything readable from the back row. */
export function ScreenApp() {
  const { state, conn } = useArena();
  const [sound, setS] = useState(false);
  useEffect(() => {
    connectArena({ role: "screen" });
    setS(soundOn(true));
  }, []);

  if (!state) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Mascot mood="sleep" size={140} />
          <Hand className="text-3xl">waiting for the arena…</Hand>
        </div>
      </main>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col px-10 py-6 text-lg">
      <header className="mb-4 flex items-center gap-4">
        <h1 className="mr-auto text-3xl font-black">
          <span className="hl">{state.eventName}</span>
        </h1>
        <span className="chip text-base">{state.playerCount} players</span>
        <ConnDot conn={conn} />
        <button
          type="button"
          className="chip text-base"
          onClick={() => {
            setSound(!sound);
            setS(!sound);
            if (!sound) sfx.pop();
          }}
        >
          {sound ? "sound on" : "sound off"}
        </button>
      </header>
      <div className="flex flex-1 flex-col">
        {state.phase === "lobby" && <LobbyScreen state={state} />}
        {state.phase === "countdown" && <CountdownScreen state={state} />}
        {state.phase === "playing" && <PlayingScreen state={state} />}
        {state.phase === "results" && <ResultsScreen state={state} />}
        {state.phase === "podium" && <PodiumScreen />}
      </div>
    </div>
  );
}

function LobbyScreen({ state }: { state: PublicState }) {
  const { lb, feed } = useArena();
  const [main, ...others] = state.joinUrls;
  return (
    <div className="grid flex-1 grid-cols-[auto_1fr] gap-12">
      <div className="flex flex-col items-center gap-4">
        <Slip taped className="flex flex-col items-center gap-3 px-8 pb-6 pt-8" tilt={-1.5}>
          <Hand className="text-3xl">scan to join</Hand>
          {main ? (
            <div className="w-[min(34vw,420px)]" dangerouslySetInnerHTML={{ __html: main.qrSvg }} />
          ) : (
            <div className="grid h-80 w-80 place-items-center text-center font-bold">Turn on the hotspot…</div>
          )}
          {main && <code className="text-2xl font-black">{main.url.replace("http://", "").replace(/\/play\/$/, "")}</code>}
          {main && <span className="chip !bg-yellow text-base">via {main.label}</span>}
        </Slip>
        {others.length > 0 && (
          <div className="flex gap-4">
            {others.map((o) => (
              <div key={o.url} className="slip flex flex-col items-center p-2">
                <div className="w-28" dangerouslySetInnerHTML={{ __html: o.qrSvg }} />
                <span className="text-xs font-bold">{o.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex items-end gap-6">
          <Mascot mood="happy" size={150} />
          <div>
            <div className="text-[7rem] font-black leading-none tabular-nums">{state.playerCount}</div>
            <Hand className="text-3xl">brains in the room</Hand>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(lb?.entries ?? []).slice(0, 60).map((e) => (
            <div key={e.id} className="flex animate-pop items-center gap-2 rounded-full border-2 border-ink bg-card py-1 pl-1 pr-3">
              <Avatar seed={e.avatar} size={34} />
              <span className="font-bold">{e.name.split(" ")[0]}</span>
              <span className="text-sm text-pencil">{e.dept}</span>
            </div>
          ))}
        </div>
        {state.nextRound && (
          <div className="text-2xl font-bold">
            First up:{" "}
            <span className="hl" style={{ ["--hl" as string]: COLOR[GAME_META[state.nextRound.game].color] }}>
              {GAME_META[state.nextRound.game].title}
            </span>
          </div>
        )}
        <Feed items={feed} max={4} big />
      </div>
    </div>
  );
}

function CountdownScreen({ state }: { state: PublicState }) {
  const round = state.round!;
  const now = useServerNow(100);
  const left = Math.ceil((round.startsAt - now) / 1000);
  const g = GAME_META[round.config.game];
  const last = useRef(99);
  useEffect(() => {
    if (left !== last.current && left >= 1 && left <= 3) sfx.count();
    if (left <= 0 && last.current > 0) sfx.go();
    last.current = left;
  }, [left]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <Hand className="text-4xl">
        round {round.index + 1} of {round.total}
      </Hand>
      <h2 className="text-8xl font-black">
        <span className="hl" style={{ ["--hl" as string]: COLOR[g.color] }}>
          {g.title}
        </span>
      </h2>
      <p className="max-w-3xl text-3xl font-semibold">{g.howTo}</p>
      <div key={left} className="stamp !text-[10rem] !leading-none !text-ink" style={{ borderColor: "var(--color-ink)" }}>
        {left > 0 ? left : "GO"}
      </div>
    </div>
  );
}

function PlayingScreen({ state }: { state: PublicState }) {
  const round = state.round!;
  const { lb, feed } = useArena();
  const now = useServerNow(250);
  const g = GAME_META[round.config.game];
  const left = round.pausedRemainingMs ?? round.endsAt - now;
  const prevSolved = useRef(round.solvedCount);
  useEffect(() => {
    if (round.solvedCount > prevSolved.current) sfx.pop();
    prevSolved.current = round.solvedCount;
  }, [round.solvedCount]);
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center gap-6">
        <div>
          <Hand className="text-2xl">
            round {round.index + 1} · {round.config.difficulty === "med" ? "medium" : round.config.difficulty}
          </Hand>
          <h2 className="text-5xl font-black">
            <span className="hl" style={{ ["--hl" as string]: COLOR[g.color] }}>
              {g.title}
            </span>
          </h2>
        </div>
        <div className="flex-1">
          <TimerBar endsAt={round.endsAt} total={round.config.timeLimitSec * 1000} now={now} paused={round.pausedRemainingMs} big />
        </div>
      </div>
      <div className="grid flex-1 grid-cols-[1.4fr_1fr] gap-10">
        <section>
          <h3 className="mb-3 text-2xl font-black">Live top 10</h3>
          <Leaderboard entries={lb?.entries ?? []} big showStatus max={10} />
        </section>
        <section className="flex flex-col gap-6">
          <Slip taped className="flex items-center gap-5 px-6 pb-5 pt-7" tilt={1}>
            <Mascot mood={round.pausedRemainingMs != null ? "sleep" : left < 10_000 ? "sweat" : "think"} size={110} />
            <div>
              <div className="text-8xl font-black leading-none tabular-nums">{round.solvedCount}</div>
              <div className="text-2xl font-bold text-pencil">of {round.activeCount} solved</div>
            </div>
          </Slip>
          {round.pausedRemainingMs != null && <div className="stamp self-center text-5xl">paused</div>}
          {round.firstSolver && (
            <div className="text-2xl">
              <Hand className="text-3xl">first blood</Hand> <b>{round.firstSolver}</b>
            </div>
          )}
          <Feed items={feed} max={6} big />
        </section>
      </div>
    </div>
  );
}

function ResultsScreen({ state }: { state: PublicState }) {
  const round = state.round!;
  const lb = useArena((s) => s.lb);
  const g = GAME_META[round.config.game];
  const [view, setView] = useState<"round" | "overall" | "depts">("round");
  // rotate panels so the room sees everything without anyone touching the laptop
  useEffect(() => {
    const t = setInterval(() => setView((v) => (v === "round" ? "overall" : v === "overall" ? "depts" : "round")), 9000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center gap-4">
        <h2 className="mr-auto text-5xl font-black">
          Round {round.index + 1} done · <span className="hl" style={{ ["--hl" as string]: COLOR[g.color] }}>{g.title}</span>
        </h2>
        {(["round", "overall", "depts"] as const).map((v) => (
          <button key={v} type="button" className={cx("chip text-base", view === v && "!bg-ink !text-paper")} onClick={() => setView(v)}>
            {v === "round" ? "this round" : v === "overall" ? "overall" : "dept wars"}
          </button>
        ))}
      </div>
      {view === "round" && (
        <div className="grid flex-1 grid-cols-[1fr_1.2fr] gap-10">
          <Slip taped className="flex flex-col items-center justify-center gap-4 p-8" tilt={-1}>
            <Hand className="text-3xl">the answer was</Hand>
            {round.reveal && <Reveal reveal={round.reveal} big />}
          </Slip>
          <div className="flex flex-col gap-2">
            {(round.results ?? []).slice(0, 8).map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border-2 border-ink bg-card px-3 py-2 text-2xl">
                <span className="w-8 font-black">{i + 1}</span>
                <Avatar seed={r.avatar} size={40} />
                <span className="flex-1 truncate font-bold">{r.name}</span>
                <span className="text-lg text-pencil">{r.solvedMs != null ? fmtSecs(r.solvedMs) : r.status}</span>
                <span className="w-24 text-right font-black">+{r.points}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {view === "overall" && <Leaderboard entries={lb?.entries ?? []} big max={10} />}
      {view === "depts" && <DeptBoard depts={lb?.depts ?? []} big />}
      {state.nextRound && (
        <div className="text-2xl font-bold">
          Next up: <span className="hl">{GAME_META[state.nextRound.game].title}</span>
        </div>
      )}
    </div>
  );
}

function PodiumScreen() {
  const lb = useArena((s) => s.lb);
  useEffect(() => sfx.win(), []);
  return (
    <div className="grid flex-1 grid-cols-[1.3fr_1fr] items-center gap-12">
      <Confetti pieces={70} />
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-7xl font-black">
          <span className="hl">Champions</span>
        </h2>
        <Podium entries={lb?.entries ?? []} big />
      </div>
      <div>
        <h3 className="mb-4 text-3xl font-black">Dept wars</h3>
        <DeptBoard depts={(lb?.depts ?? []).slice(0, 8)} big />
      </div>
    </div>
  );
}
