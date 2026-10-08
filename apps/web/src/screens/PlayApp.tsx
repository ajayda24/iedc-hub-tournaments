"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GAME_META } from "@iedc/shared/games/meta";
import { EV, type MeState, type PublicState, type SubmitAck } from "@iedc/shared/protocol";
import { connectArena, emitAck, reconnectArena, useArena } from "@/net/arena";
import { useServerNow } from "@/net/useNow";
import { cx, firstName, fmtSecs, ordinal } from "@/lib/format";
import { useAntiCheat, useNoCopy } from "@/anticheat/useAntiCheat";
import { InternetBlock, StrikeBanner } from "@/anticheat/Overlays";
import { VIEWS } from "@/games";
import { Avatar } from "@/ui/Avatar";
import { Confetti } from "@/ui/Confetti";
import { Feed } from "@/ui/Feed";
import { Btn, COLOR, ConnDot, Hand, Slip } from "@/ui/kit";
import { DeptBoard, Leaderboard } from "@/ui/Leaderboard";
import { Mascot } from "@/ui/Mascot";
import { Podium, titleFor } from "@/ui/Podium";
import { Reveal } from "@/ui/Reveal";
import { setSound, sfx, soundOn } from "@/ui/sfx";
import { TimerBar } from "@/ui/Timer";
import { JoinForm } from "./JoinForm";
import { leaderboard as LB } from "@iedc/data/copy/leaderboard";
import { DIFFICULTY_LABEL } from "@iedc/data/games";
import { common } from "@iedc/data/copy/common";
import { play as t } from "@iedc/data/copy/play";

export function PlayApp() {
  const { conn, helloDone, state, me, kicked, bumped } = useArena();

  useEffect(() => {
    connectArena({ role: "player" });
  }, []);

  if (bumped) return <Note mood="sleep" title={t.bumpedTitle} body={bumped} />;
  if (kicked)
    return (
      <Note mood="dizzy" title={t.kickedTitle} body={kicked}>
        <Btn onClick={() => reconnectArena({ role: "player" })}>{t.tryAgain}</Btn>
      </Note>
    );
  if (!helloDone || !state) {
    return (
      <Note
        mood="sleep"
        title={conn === "offline" ? t.offlineTitle : t.connectingTitle}
        body={conn === "offline" ? t.offlineBody : t.connectingBody}
      />
    );
  }
  if (!me) return <JoinForm />;
  return <Joined state={state} me={me} />;
}

/* ------------------------------------------------------------------ */

function Joined({ state, me }: { state: PublicState; me: MeState }) {
  const conn = useArena((s) => s.conn);
  const round = state.round;
  const myRound = me.round && round && me.round.roundId === round.id ? me.round : null;
  const live = state.phase === "playing" && !!round && round.pausedRemainingMs === null;
  const inPlay = live && !me.eliminated && myRound?.status === "playing";
  const { internet, strike, clearStrike } = useAntiCheat({ probe: state.blockInternet, watchFocus: inPlay });
  useNoCopy(state.phase === "playing");
  const blocked = (internet || me.internetBlocked) && state.blockInternet;

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar me={me} conn={conn} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-10 pt-3">
        {state.phase === "lobby" && <Lobby state={state} me={me} />}
        {state.phase === "countdown" && round && <Countdown state={state} />}
        {state.phase === "playing" && round && <Playing state={state} me={me} frozen={blocked} />}
        {state.phase === "results" && round && <Results state={state} me={me} />}
        {state.phase === "podium" && <Final me={me} />}
      </main>
      {blocked && state.phase !== "podium" && <InternetBlock />}
      {strike && <StrikeBanner strike={strike} onClose={clearStrike} />}
    </div>
  );
}

function TopBar({ me, conn }: { me: MeState; conn: string }) {
  const [sound, setS] = useState(() => soundOn(false));
  const prevScore = useRef(me.score);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (me.score > prevScore.current) setBump((b) => b + 1);
    prevScore.current = me.score;
  }, [me.score]);
  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-xl items-center gap-2.5 px-4 py-2">
        <Avatar seed={me.avatar} size={36} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-bold">{me.name}</div>
          <ConnDot conn={conn} />
        </div>
        <button
          type="button"
          onClick={() => {
            setSound(!sound);
            setS(!sound);
          }}
          className="chip !px-2 text-xs"
          aria-label={common.toggleSound}
        >
          {sound ? common.soundOn : common.muted}
        </button>
        <div className="text-right leading-tight">
          <div key={bump} className={cx("text-xl font-black tabular-nums", bump > 0 && "animate-pop")}>
            {me.score}
          </div>
          <div className="text-xs font-bold text-pencil">
            #{me.rank || "–"}/{me.of}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------ lobby ------------------------------ */

function Lobby({ state, me }: { state: PublicState; me: MeState }) {
  const { lb, feed } = useArena();
  const [tab, setTab] = useState<"players" | "depts">("players");
  return (
    <div className="flex flex-col gap-5">
      <section className="flex items-center gap-3 pt-2">
        <Mascot mood="idle" size={84} />
        <div>
          <h1 className="text-3xl font-black leading-tight">
            {t.youreIn} <span className="hl">{firstName(me.name)}</span>!
          </h1>
          <Hand className="text-lg">{t.hostCooking}</Hand>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Slip className="px-3 py-2" tilt={-1}>
          <div className="text-3xl font-black tabular-nums">{state.playerCount}</div>
          <div className="text-sm font-semibold text-pencil">{t.playersJoined}</div>
        </Slip>
        <Slip className="px-3 py-2" tilt={1}>
          <div className="text-3xl font-black tabular-nums">
            {state.roundsPlayed}/{state.roundsTotal}
          </div>
          <div className="text-sm font-semibold text-pencil">{t.roundsPlayed}</div>
        </Slip>
      </div>

      {state.nextRound && <NextUp cfg={state.nextRound} />}

      <a href="/leaderboard/" className="self-start text-sm font-bold underline decoration-2 underline-offset-4">
        {LB.linkLabel}
      </a>

      {feed.length > 0 && (
        <section>
          <h2 className="mb-2 font-black">{t.liveGossip}</h2>
          <Feed items={feed} max={4} />
        </section>
      )}

      {lb && (
        <section>
          <Tabs tab={tab} setTab={setTab} />
          <div className="mt-3">
            {tab === "players" ? <Leaderboard entries={lb.entries} meId={me.id} me={me} max={15} /> : <DeptBoard depts={lb.depts} myDept={me.dept} />}
          </div>
        </section>
      )}
    </div>
  );
}

function NextUp({ cfg }: { cfg: NonNullable<PublicState["nextRound"]> }) {
  const g = GAME_META[cfg.game];
  return (
    <Slip taped className="px-4 pb-4 pt-5" tilt={-0.8} style={{ background: COLOR[g.color] }}>
      <Hand className="text-lg">{t.nextUp}</Hand>
      <div className="text-2xl font-black">{g.title}</div>
      <div className="text-sm font-bold uppercase tracking-wide">
        {DIFFICULTY_LABEL[cfg.difficulty]} · {common.minutes(Math.round(cfg.timeLimitSec / 6) / 10)}
      </div>
      <p className="mt-2 text-sm font-medium">{g.howTo}</p>
    </Slip>
  );
}

function Tabs({ tab, setTab, withRound }: { tab: string; setTab: (t: any) => void; withRound?: boolean }) {
  const tabs = [...(withRound ? [["round", common.tabs.round]] : []), ["players", common.tabs.players], ["depts", common.tabs.depts]];
  return (
    <div className="flex gap-2">
      {tabs.map(([k, label]) => (
        <button key={k} type="button" onClick={() => setTab(k)} className={cx("chip !px-3 !py-1", tab === k && "!bg-ink !text-paper")}>
          {label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------- countdown ---------------------------- */

function Countdown({ state }: { state: PublicState }) {
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
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <Hand className="text-xl">{t.roundOf(round.index + 1, round.total)}</Hand>
      <h1 className="text-4xl font-black">
        <span className="hl" style={{ ["--hl" as string]: COLOR[g.color] }}>
          {g.title}
        </span>
      </h1>
      <p className="max-w-xs font-semibold">{g.howTo}</p>
      <div key={left} className="stamp !text-7xl !text-ink" style={{ borderColor: "var(--color-ink)" }}>
        {left > 0 ? left : t.go}
      </div>
      <Btn
        size="sm"
        tone="paper"
        onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
      >
        {t.fullscreen}
      </Btn>
    </div>
  );
}

/* ----------------------------- playing ----------------------------- */

function Playing({ state, me, frozen }: { state: PublicState; me: MeState; frozen: boolean }) {
  const round = state.round!;
  const lb = useArena((s) => s.lb);
  const now = useServerNow(250);
  const myRound = me.round && me.round.roundId === round.id ? me.round : null;
  const status = me.eliminated ? "out" : myRound?.status ?? "playing";
  const paused = round.pausedRemainingMs;
  const View = VIEWS[round.config.game];
  const g = GAME_META[round.config.game];
  const [stamp, setStamp] = useState(false);

  const submit = useCallback(
    async (sub: unknown) => {
      const res = await emitAck<SubmitAck>(EV.submit, { roundId: round.id, sub });
      if (res.status === "solved") {
        sfx.win();
        setStamp(true);
      } else if (res.status === "wrong") sfx.buzz();
      else if (res.status === "failed") sfx.buzz();
      return res;
    },
    [round.id],
  );

  const left = paused ?? round.endsAt - now;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Hand className="text-base">
            R{round.index + 1} · {DIFFICULTY_LABEL[round.config.difficulty]}
          </Hand>
          <h1 className="truncate text-xl font-black leading-tight">{g.title}</h1>
        </div>
        <Mascot mood={paused != null ? "sleep" : left < 10_000 ? "sweat" : "think"} size={46} bob={false} />
      </div>
      <TimerBar endsAt={round.endsAt} total={round.config.timeLimitSec * 1000} now={now} paused={paused} />
      <div className="flex items-center justify-between text-sm font-bold">
        <span>
          {t.you} #{me.rank}
          {me.delta !== 0 && <span className={me.delta > 0 ? "text-ok" : "text-stamp"}> {me.delta > 0 ? `▲${me.delta}` : `▼${-me.delta}`}</span>}
        </span>
        <span className="text-pencil">
          {t.solvedCount(round.solvedCount, round.activeCount)}
        </span>
      </div>

      {paused != null && (
        <Slip className="py-3 text-center !bg-yellow">
          <b>{t.pausedBold}</b>
          {t.pausedRest}
        </Slip>
      )}

      {status === "playing" ? (
        <div className="pt-2">
          <View pub={round.pub} progress={myRound?.progress ?? null} done={false} frozen={frozen || paused != null} submit={submit} />
        </div>
      ) : (
        <DoneCard status={status} points={myRound?.points ?? 0} stamp={stamp} />
      )}

      {status !== "playing" && lb && (
        <section className="mt-2">
          <h2 className="mb-2 font-black">{t.liveTop}</h2>
          <Leaderboard entries={lb.entries} meId={me.id} me={me} showStatus />
        </section>
      )}
    </div>
  );
}

function DoneCard({ status, points, stamp }: { status: string; points: number; stamp: boolean }) {
  const map: Record<string, { mood: "happy" | "dizzy" | "sleep" | "shock"; title: string; body: string }> = {
    solved: { mood: "happy", ...t.done.solved },
    failed: { mood: "dizzy", ...t.done.failed },
    locked: { mood: "shock", ...t.done.locked },
    out: { mood: "sleep", ...t.done.out },
    timeout: { mood: "sleep", ...t.done.timeout },
  };
  const m = map[status] ?? map.timeout;
  return (
    <Slip taped className="mt-3 flex flex-col items-center gap-2 px-4 pb-5 pt-7 text-center" tilt={-1}>
      {status === "solved" && stamp && <Confetti />}
      <Mascot mood={m.mood} size={80} />
      <div className={cx(status === "solved" ? "stamp text-4xl" : "text-3xl font-black")}>{m.title}</div>
      {points > 0 && <div className="text-2xl font-black">+{points}</div>}
      <p className="font-semibold text-ink-soft">{m.body}</p>
    </Slip>
  );
}

/* ----------------------------- results ----------------------------- */

function Results({ state, me }: { state: PublicState; me: MeState }) {
  const round = state.round!;
  const lb = useArena((s) => s.lb);
  const [tab, setTab] = useState<"round" | "players" | "depts">("round");
  const mine = round.results?.find((r) => r.id === me.id);
  const myPoints = me.round?.roundId === round.id ? me.round.points : mine?.points ?? 0;
  const status = me.round?.roundId === round.id ? me.round.status : mine?.status;
  const g = GAME_META[round.config.game];
  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-center gap-3 pt-1">
        <Mascot mood={status === "solved" ? "happy" : "dizzy"} size={70} />
        <div>
          <Hand className="text-lg">{t.resultsRound(round.index + 1, g.title)}</Hand>
          <h1 className="text-3xl font-black leading-tight">
            {status === "solved" ? t.resultSolved : myPoints > 0 ? t.resultSome : t.resultNone}{" "}
            <span className="hl">+{myPoints}</span>
          </h1>
          <div className="text-sm font-bold text-pencil">
            {t.nowRank(ordinal(me.rank), me.of)}
            {me.delta !== 0 && <span className={me.delta > 0 ? "text-ok" : "text-stamp"}> ({me.delta > 0 ? t.up(me.delta) : t.down(-me.delta)})</span>}
          </div>
        </div>
      </section>

      {me.eliminated && state.format === "knockout" && (
        <Slip className="py-2 text-center !bg-coral font-bold">{t.knockedOut}</Slip>
      )}

      <Tabs tab={tab} setTab={setTab} withRound />

      {tab === "round" && (
        <div className="flex flex-col gap-4">
          {round.reveal && (
            <Slip taped className="flex flex-col items-center gap-3 px-3 pb-4 pt-6" tilt={0.6}>
              <Hand className="text-lg">{common.answerWas}</Hand>
              <Reveal reveal={round.reveal} />
            </Slip>
          )}
          <div className="flex flex-col gap-1.5">
            {(round.results ?? []).slice(0, 10).map((r, i) => (
              <div key={r.id} className={cx("flex items-center gap-2 rounded-lg border-2 border-ink bg-card px-2 py-1.5", r.id === me.id && "!bg-yellow")}>
                <span className="w-6 text-center font-black">{i + 1}</span>
                <Avatar seed={r.avatar} size={28} />
                <span className="flex-1 truncate font-bold">{r.name}</span>
                <span className="text-xs text-pencil">{r.solvedMs != null ? fmtSecs(r.solvedMs) : r.status}</span>
                <span className="w-14 text-right font-black">+{r.points}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "players" && lb && <Leaderboard entries={lb.entries} meId={me.id} me={me} />}
      {tab === "depts" && lb && <DeptBoard depts={lb.depts} myDept={me.dept} />}

      {state.nextRound && <NextUp cfg={state.nextRound} />}
    </div>
  );
}

/* ------------------------------ podium ----------------------------- */

function Final({ me }: { me: MeState }) {
  const lb = useArena((s) => s.lb);
  const entries = lb?.entries ?? [];
  const idx = entries.findIndex((e) => e.id === me.id);
  const title = useMemo(() => (idx >= 0 ? titleFor(entries[idx], idx, entries.length) : ""), [entries, idx]);
  useEffect(() => sfx.win(), []);
  return (
    <div className="flex flex-col gap-6 pt-2">
      <Confetti pieces={50} />
      <h1 className="text-center text-4xl font-black">
        <span className="hl">{t.wrap}</span>
      </h1>
      <Podium entries={entries} />
      <Slip taped className="px-4 pb-4 pt-6 text-center" tilt={-1}>
        <Hand className="text-lg">{t.youFinished}</Hand>
        <div className="text-5xl font-black">{ordinal(me.rank)}</div>
        <div className="font-bold">{t.points(me.score)}</div>
        {title && <div className="stamp mt-3 text-xl">{title}</div>}
      </Slip>
      <a href="/leaderboard/" className="sticker self-center !bg-yellow">
        {LB.linkLabel}
      </a>
      <Leaderboard entries={entries} meId={me.id} me={me} />
    </div>
  );
}

/* ------------------------------ misc ------------------------------- */

function Note({ mood, title, body, children }: { mood: "sleep" | "dizzy"; title: string; body: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <Mascot mood={mood} size={110} />
      <h1 className="text-3xl font-black">{title}</h1>
      <p className="font-semibold text-ink-soft">{body}</p>
      {children}
    </main>
  );
}
