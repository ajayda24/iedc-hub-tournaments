"use client";
import { useEffect, useRef, useState } from "react";
import type { WallTeam, WallView } from "@iedc/shared/competitions/vibecoding/protocol";
import { vc } from "@iedc/config/copy/vibecoding";
import { cx } from "@/lib/format";
import { Hand, Slip } from "@/ui/kit";
import { Mascot } from "@/ui/Mascot";
import { Confetti } from "@/ui/Confetti";
import { COMPETITION, Clock, Piece } from "./bits";
import { connectVc, useVc } from "./net";
import { siteUrl } from "./Publish";

const S = vc.screen;

const STAGE_ICON: Record<string, string> = { registered: "📝", ready: "✋", tiles: "🧱", puzzle: "🧩", published: "🚀", change_request: "📞", done: "✅" };

/** The projector wall for Tile Rush: big type, icons with every colour, readable from the back row. */
export function VcScreenApp() {
  const wall = useVc((s) => s.wall);
  useEffect(() => {
    connectVc({ competition: COMPETITION, role: "screen" });
  }, []);
  if (!wall)
    return (
      <main className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Mascot mood="sleep" size={140} />
          <Hand className="text-3xl">{S.waiting}</Hand>
        </div>
      </main>
    );
  const phase = wall.clock.phase;
  if (phase === "showcase" && wall.showcaseTeam) return <ShowcaseSite wall={wall} />;
  return (
    <div className="flex h-dvh flex-col gap-4 overflow-hidden px-8 py-5">
      <header className="flex items-center gap-6">
        <Mascot mood={phase === "build" ? "think" : phase === "showcase" || phase === "closed" ? "crown" : "happy"} size={64} />
        <div className="mr-auto">
          <h1 className="text-5xl font-black leading-none">
            <span className="hl">{wall.title}</span>
          </h1>
          <Hand className="text-2xl">{wall.projectName}</Hand>
        </div>
        <span className="chip text-2xl">{vc.phase[phase]}</span>
        {(phase === "build" || phase === "frozen") && (
          <div className="text-center">
            <Clock big />
            {wall.clock.paused && <div className="font-black text-stamp">⏸ {vc.host.pause}</div>}
          </div>
        )}
      </header>
      {phase === "setup" || phase === "registration" || phase === "warmup" ? (
        <Registration wall={wall} />
      ) : phase === "showcase" || phase === "closed" ? (
        <Finale wall={wall} />
      ) : (
        <Live wall={wall} />
      )}
      <footer className="flex items-center gap-4 text-lg font-bold text-ink-soft">
        <span>🤖 {S.models(wall.health.modelsOk, wall.health.modelsTotal)}</span>
        {wall.health.safeMode && <span className="chip !bg-coral">🛟 {S.safe}</span>}
        <span>⚡ {S.perMin(wall.health.asksPerMin)}</span>
        <span className="ml-auto">{wall.teams.length} teams</span>
      </footer>
    </div>
  );
}

function Registration({ wall }: { wall: WallView }) {
  const url = wall.joinUrls[0];
  return (
    <div className="grid flex-1 grid-cols-[auto_1fr] gap-8">
      <Slip className="flex flex-col items-center gap-3 p-6 text-center" taped>
        <Hand className="text-3xl">{S.join}</Hand>
        {url ? <div className="w-80" dangerouslySetInnerHTML={{ __html: url.qrSvg }} /> : <Mascot mood="think" size={200} />}
        {url && <div className="font-mono text-2xl font-black">{url.url.replace(/^https?:\/\//, "")}</div>}
      </Slip>
      <div className="grid content-start gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
        {wall.teams.length === 0 && <Hand className="text-3xl">{S.noTeams}</Hand>}
        {wall.teams.map((t) => (
          <Slip key={t.id} className="p-4">
            <div className="text-2xl font-black">
              {STAGE_ICON[t.stage]} {t.name}
            </div>
            <div className="text-lg font-semibold">{t.members.join(", ")}</div>
          </Slip>
        ))}
      </div>
    </div>
  );
}

/** Rank changes since the last update, for the ▲▼ arrows. */
function useRankDelta(teams: WallTeam[]) {
  const prev = useRef(new Map<string, number>());
  const [delta, setDelta] = useState(new Map<string, number>());
  useEffect(() => {
    const d = new Map<string, number>();
    for (const t of teams) {
      const before = prev.current.get(t.id);
      if (before != null && before !== t.rank) d.set(t.id, before - t.rank);
    }
    if (d.size) setDelta(d);
    prev.current = new Map(teams.map((t) => [t.id, t.rank]));
  }, [teams]);
  return delta;
}

function Live({ wall }: { wall: WallView }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 20_000);
    return () => clearInterval(t);
  }, []);
  const spot = wall.spotlight ?? (wall.teams.length ? wall.teams[tick % wall.teams.length].id : null);
  const delta = useRankDelta(wall.teams);
  const cols = wall.teams.length > 12 ? 5 : wall.teams.length > 6 ? 4 : 3;
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1fr_380px] gap-6">
      <div className="grid content-start gap-3" style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` }}>
        {wall.teams.map((t) => (
          <TeamCard key={t.id} team={t} spot={t.id === spot} />
        ))}
      </div>
      <div className="flex min-h-0 flex-col gap-4">
        <Slip className="p-4">
          <div className="mb-2 text-xl font-black">🏆 {S.leaderboard}</div>
          <ol className="flex flex-col gap-1">
            {wall.teams.slice(0, 10).map((t) => {
              const d = delta.get(t.id) ?? 0;
              return (
                <li key={t.id} className="flex items-center gap-2 text-xl">
                  <span className="w-8 text-right font-black">{t.rank}</span>
                  <span className={cx("w-6 text-sm font-black", d > 0 ? "text-mint" : d < 0 ? "text-stamp" : "opacity-0")}>{d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : "·"}</span>
                  <span className="mr-auto truncate font-bold">{t.name}</span>
                  <span className="font-black tabular-nums">{t.score}</span>
                </li>
              );
            })}
          </ol>
        </Slip>
        <Slip className="min-h-0 flex-1 overflow-hidden p-4">
          <div className="mb-2 text-xl font-black">📣 {S.feed}</div>
          <ul className="flex flex-col gap-1.5 text-lg">
            {[...wall.feed].reverse().map((f) => (
              <li key={f.id} className="font-semibold leading-tight">
                {f.text}
              </li>
            ))}
          </ul>
        </Slip>
      </div>
    </div>
  );
}

function TeamCard({ team, spot }: { team: WallTeam; spot: boolean }) {
  const revealed = new Set(team.revealed);
  return (
    <Slip className={cx("flex flex-col gap-2 p-3 transition-transform", spot && "z-10 scale-105 ring-4 ring-yellow")}>
      <div className="flex items-start gap-2">
        <span className="chip !py-0 text-lg font-black">#{team.rank}</span>
        <div className="mr-auto min-w-0">
          <div className="truncate text-xl font-black leading-tight">{team.name}</div>
          {spot && <Hand className="text-base">🔦 {S.spotlight}</Hand>}
        </div>
        <span className="text-2xl font-black tabular-nums">{team.score}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="grid grid-cols-3 gap-px rounded border-2 border-ink p-px">
          {[1, 2, 3, 4, 5, 6, 7, 8, 0].map((n) => (n === 0 ? <div key="e" style={{ width: 24, height: 24 }} /> : <Piece key={n} n={n} size={24} faded={!revealed.has(n)} />))}
        </div>
        <div className="flex flex-col gap-1 text-base font-bold">
          <span className="chip !py-0">
            {STAGE_ICON[team.stage]} {team.stage === "tiles" ? `${team.tilesDone}/8` : vc.stage[team.stage]}
          </span>
          {team.badges.length > 0 && <span className="text-sm">🏅 {team.badges.length}</span>}
        </div>
      </div>
    </Slip>
  );
}

function Finale({ wall }: { wall: WallView }) {
  const top = wall.teams.slice(0, 3);
  const order = [top[1], top[0], top[2]].filter(Boolean);
  return (
    <div className="grid flex-1 grid-cols-[1fr_520px] gap-8">
      <Confetti pieces={50} />
      <div className="flex items-end justify-center gap-6">
        {order.map((t) => {
          const place = t.rank;
          return (
            <div key={t.id} className="flex flex-col items-center gap-2">
              <div className="text-3xl font-black">{t.name}</div>
              <div className="text-2xl font-bold tabular-nums">{t.score}</div>
              <div
                className={cx("flex w-48 items-start justify-center rounded-t-xl border-4 border-ink pt-3 text-5xl font-black", place === 1 ? "bg-yellow" : place === 2 ? "bg-sky" : "bg-coral")}
                style={{ height: place === 1 ? 260 : place === 2 ? 190 : 140 }}
              >
                {place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"}
              </div>
            </div>
          );
        })}
      </div>
      <Slip className="flex flex-col gap-3 p-5">
        <div className="text-2xl font-black">🏅 {S.awards}</div>
        {(wall.awards ?? []).map((a) => (
          <div key={a.id} className="text-xl">
            <b>{a.title}</b>: {a.teamName ?? "—"} <span className="text-base text-ink-soft">{a.detail}</span>
          </div>
        ))}
        {wall.votingOpen && <Hand className="text-2xl">🗳 {vc.vote.title}</Hand>}
      </Slip>
    </div>
  );
}

/** Showcase: one team's published site, full screen. */
function ShowcaseSite({ wall }: { wall: WallView }) {
  const t = wall.teams.find((x) => x.id === wall.showcaseTeam);
  if (!t?.sitePath) return null;
  return (
    <div className="flex h-dvh flex-col">
      <div className="flex items-center gap-4 border-b-4 border-ink bg-yellow px-6 py-2">
        <span className="text-3xl font-black">🚀 {t.name}</span>
        <span className="text-xl font-semibold">{t.members.join(", ")}</span>
        <span className="ml-auto text-2xl font-black">#{t.rank}</span>
      </div>
      <iframe title={t.name} src={siteUrl(wall.sitesPort, t.sitePath)} className="flex-1 bg-white" />
    </div>
  );
}
