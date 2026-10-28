"use client";
import { useEffect, useState } from "react";
import { EVC, type HostTeam, type HostView, type WallView } from "@iedc/shared/competitions/vibecoding/protocol";
import { TILE_IDS, tileConfig } from "@iedc/shared/competitions/vibecoding/config";
import { vc } from "@iedc/config/copy/vibecoding";
import { cx } from "@/lib/format";
import { Btn, ConnDot, Hand, Slip } from "@/ui/kit";
import { Mascot } from "@/ui/Mascot";
import { Feed } from "@/ui/Feed";
import { COMPETITION, Clock, Toast, fmtMin } from "./bits";
import { connectVc, reconnectVc, showToast, useVc, vcAct } from "./net";

const H = vc.host;
const PIN_KEY = "ba:pin";
const NEXT: Record<string, string> = { setup: "registration", registration: "warmup", warmup: "build", build: "frozen", frozen: "showcase", showcase: "closed" };
type Tab = "control" | "teams" | "people" | "setup" | "ai" | "network" | "showcase";

/** The host console for Vibe Hackathon. Same PIN as the weekly host console. */
export function VcHostApp() {
  const { host, wall, helloDone, helloError, conn } = useVc();
  const [pin, setPin] = useState("");
  const [tried, setTried] = useState(false);
  useEffect(() => {
    const saved = sessionStorage.getItem(PIN_KEY);
    if (saved) {
      setTried(true);
      connectVc({ competition: COMPETITION, role: "host", pin: saved });
    }
  }, []);
  const login = () => {
    sessionStorage.setItem(PIN_KEY, pin);
    setTried(true);
    reconnectVc({ competition: COMPETITION, role: "host", pin });
  };
  if (!host || !wall) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <Mascot mood={helloError ? "dizzy" : "think"} size={100} />
        <h1 className="text-3xl font-black">
          <span className="hl">{H.title}</span>
        </h1>
        <p className="font-semibold text-ink-soft">{H.pinHint}</p>
        <input
          className="field text-center text-3xl tracking-[0.4em]"
          inputMode="numeric"
          maxLength={8}
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && login()}
        />
        <Btn size="lg" tone="mint" className="w-full" onClick={login} disabled={pin.length < 4}>
          {H.enter}
        </Btn>
        {tried && helloDone && helloError && <p className="hand text-xl text-stamp">{helloError}</p>}
        {tried && conn === "offline" && <p className="hand text-xl text-stamp">{vc.cantReach}</p>}
      </main>
    );
  }
  return <Console host={host} wall={wall} />;
}

function Console({ host, wall }: { host: HostView; wall: WallView }) {
  const conn = useVc((s) => s.conn);
  const [tab, setTab] = useState<Tab>("control");
  const phase = wall.clock.phase;
  const sites = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:${wall.sitesPort}/sites/` : "#";
  return (
    <div className="min-h-dvh pb-16">
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5">
          <Mascot mood="idle" size={34} bob={false} />
          <div className="mr-auto leading-tight">
            <div className="text-xl font-black">{H.title}</div>
            <ConnDot conn={conn} />
          </div>
          <span className="chip">{vc.phase[phase]}</span>
          <Clock className="!text-2xl" />
          <a className="sticker !bg-sky !px-3 !py-1.5 text-sm" href="../screen/" target="_blank" rel="noreferrer">
            Big screen ↗
          </a>
          <a className="sticker !bg-lilac !px-3 !py-1.5 text-sm" href={sites} target="_blank" rel="noreferrer">
            Sites ↗
          </a>
        </div>
        <nav className="mx-auto flex max-w-7xl flex-wrap gap-2 px-4 pb-2">
          {(Object.keys(H.tabs) as Tab[]).map((k) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={cx("chip !px-3 !py-1.5", tab === k && "!bg-ink !text-paper")}>
              {H.tabs[k]}
              {k === "teams" ? ` (${host.teams.length})` : k === "people" ? ` (${host.people.length})` : ""}
              {k === "ai" && (host.health.safeMode || host.health.autoSafe) ? " ⚠️" : ""}
            </button>
          ))}
        </nav>
      </header>
      <div className="mx-auto max-w-7xl px-4 pt-4">
        {tab === "control" && <Control host={host} wall={wall} />}
        {tab === "teams" && <Teams host={host} />}
        {tab === "people" && <People host={host} />}
        {tab === "setup" && <Setup host={host} />}
        {tab === "ai" && <Ai host={host} />}
        {tab === "network" && <Network host={host} wall={wall} />}
        {tab === "showcase" && <Showcase host={host} wall={wall} />}
      </div>
      <Toast />
    </div>
  );
}

const act = async (event: string, payload?: unknown) => (await vcAct(event, payload))?.ok ?? false;

function Control({ host, wall }: { host: HostView; wall: WallView }) {
  const phase = wall.clock.phase;
  const next = NEXT[phase];
  const min = host.settings.minTeamSize;
  const small = host.teams.filter((t) => t.members.length < min).length;
  const go = (to: string) => {
    if (to === "frozen" && !confirm(H.confirmFreeze)) return;
    if (to === "closed" && !confirm(H.confirmClose)) return;
    void act(EVC.hostPhase, { phase: to });
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Slip className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            {next && (
              <Btn size="lg" tone={next === "frozen" ? "coral" : "mint"} onClick={() => go(next)}>
                {H.next[phase]}
              </Btn>
            )}
            {phase === "registration" && (
              <Btn tone="paper" onClick={() => go("build")}>
                {H.skipWarmup}
              </Btn>
            )}
          </div>
          {phase === "build" && (
            <div className="flex flex-wrap gap-2">
              {wall.clock.paused ? (
                <Btn tone="mint" onClick={() => act(EVC.hostResume)}>
                  ▶ {H.resume}
                </Btn>
              ) : (
                <Btn tone="yellow" onClick={() => act(EVC.hostPause)}>
                  ⏸ {H.pause}
                </Btn>
              )}
              {[5, 10].map((m) => (
                <Btn key={m} tone="paper" onClick={() => act(EVC.hostExtend, { minutes: m })}>
                  {H.extend(m)}
                </Btn>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
            <span>{H.teams(host.teams.length)}</span>
            <span>{H.people(host.people.length)}</span>
            <Btn size="sm" tone="paper" onClick={() => act(EVC.hostSettings, { registrationLocked: !host.settings.registrationLocked })}>
              {host.settings.registrationLocked ? `🔓 ${H.unlock}` : `🔒 ${H.lock}`}
            </Btn>
          </div>
          {small > 0 && <p className="text-sm font-bold text-stamp">{H.smallTeams(small, min)}</p>}
        </Slip>
        <Slip className="flex flex-wrap gap-2 p-4">
          <Btn
            tone="sky"
            onClick={async () => {
              const r = await vcAct<{ ok: boolean; dir?: string }>(EVC.hostExport);
              if (r?.ok && r.dir) showToast(H.exported(r.dir));
            }}
          >
            ⬇ {H.export}
          </Btn>
          <Btn
            tone="paper"
            onClick={() => {
              if (confirm(H.newRunConfirm)) void act(EVC.hostNewRun);
            }}
          >
            ✨ {H.newRun}
          </Btn>
        </Slip>
      </div>
      <Slip className="p-4">
        <Leaderboard wall={wall} />
        <div className="mt-3">
          <Feed items={wall.feed.map((f) => ({ id: f.id, at: f.at, kind: "info", text: f.text }))} max={8} />
        </div>
      </Slip>
    </div>
  );
}

function Leaderboard({ wall }: { wall: WallView }) {
  return (
    <ol className="flex flex-col gap-1">
      {wall.teams.map((t) => (
        <li key={t.id} className="flex items-center gap-2 text-sm">
          <span className="w-6 text-right font-black">{t.rank}</span>
          <span className="mr-auto font-bold">{t.name}</span>
          <span className="chip !py-0 text-xs">{vc.stage[t.stage]}</span>
          <span className="w-12 text-right text-xs font-bold">{t.tilesDone}/8</span>
          <span className="w-14 text-right font-black tabular-nums">{t.score}</span>
        </li>
      ))}
    </ol>
  );
}

function Teams({ host }: { host: HostView }) {
  const [sel, setSel] = useState<string | null>(null);
  const team = host.teams.find((t) => t.id === sel) ?? null;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Slip className="p-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-ink-soft">
              <th>#</th>
              <th>Team</th>
              <th>Size</th>
              <th>Stage</th>
              <th>Tiles</th>
              <th>Asks</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {host.teams.map((t) => (
              <tr key={t.id} className={cx("cursor-pointer border-t border-ink/10", sel === t.id && "bg-yellow/40")} onClick={() => setSel(t.id)}>
                <td className="font-black">{t.rank}</td>
                <td className="font-bold">
                  {t.name} <span className="text-xs text-ink-soft">{t.code}</span>
                </td>
                <td>{t.members.length}</td>
                <td>{vc.stage[t.stage]}</td>
                <td>{t.tiles.filter((x) => x.id !== "warmup" && x.done).length}/8</td>
                <td>{t.asksUsed}</td>
                <td className="font-black tabular-nums">{t.score.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Slip>
      {team && <TeamDetail team={team} />}
    </div>
  );
}

function TeamDetail({ team }: { team: HostTeam }) {
  const op = (o: Record<string, unknown>) => act(EVC.hostTeam, { teamId: team.id, ...o });
  return (
    <Slip className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-2xl font-black">{team.name}</h2>
        <Btn size="sm" tone="sky" onClick={() => act(EVC.hostSpotlight, { teamId: team.id })}>
          🔦 {H.spotlight}
        </Btn>
        <Btn
          size="sm"
          tone="yellow"
          onClick={() => {
            const text = prompt(H.messagePrompt, team.message?.text ?? "");
            if (text != null) void op({ op: "message", text });
          }}
        >
          💬 {H.message}
        </Btn>
        {!team.glitch.done && !team.glitch.cancelled && (
          <>
            <Btn size="sm" tone="coral" onClick={() => op({ op: "glitchFire" })}>
              ☕ {H.glitchFire}
            </Btn>
            <Btn size="sm" tone="paper" onClick={() => op({ op: "glitchCancel" })}>
              {H.glitchCancel}
            </Btn>
          </>
        )}
      </div>
      <p className="text-sm font-semibold">
        {team.members.map((m) => `${m.name}${m.online ? " ●" : " ○"}`).join(", ")} · glitch at {fmtMin(team.glitch.at)}
        {team.glitch.done ? " (done)" : team.glitch.cancelled ? " (cancelled)" : team.glitch.armed ? " (armed)" : ""} · cooldown waited {fmtMin(team.cooldownWaitMs)}
      </p>
      <table className="w-full text-sm">
        <tbody>
          {team.tiles
            .filter((t) => t.id !== "warmup")
            .map((t) => (
              <tr key={t.id} className="border-t border-ink/10">
                <td>
                  {t.emoji} {t.title}
                </td>
                <td>{t.done ? (t.autoSolved ? "done (help)" : "✅") : t.holder ? `✍ ${t.holder.name}` : t.firstOpenedAt != null ? "open" : "—"}</td>
                <td>{t.checklist.filter((c) => c.pass).length}/{t.checklist.length}</td>
                <td>
                  {t.asks} asks{t.edits ? ` · ${t.edits} edits` : ""}
                </td>
                <td>{t.hintsUsed.length} hints</td>
                <td>{t.firstOpenedAt != null ? fmtMin((t.doneAt ?? 0) - t.firstOpenedAt > 0 ? (t.doneAt ?? 0) - t.firstOpenedAt : 0) : ""}</td>
                <td>
                  {!t.done && (
                    <button type="button" className="text-xs font-bold underline" onClick={() => op({ op: "unlockTile", tileId: t.id })}>
                      {H.unlockTile}
                    </button>
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {team.notes && <p className="rounded-lg bg-yellow/30 p-2 text-sm">📝 {team.notes}</p>}
      <div className="flex gap-2">
        <Btn
          size="sm"
          tone="paper"
          onClick={() => {
            if (confirm(H.resetConfirm)) void op({ op: "reset" });
          }}
        >
          {H.reset}
        </Btn>
        <Btn
          size="sm"
          tone="coral"
          onClick={() => {
            if (confirm(H.removeConfirm)) void op({ op: "remove" });
          }}
        >
          {H.remove}
        </Btn>
      </div>
    </Slip>
  );
}

function People({ host }: { host: HostView }) {
  const teamName = (id: string | null) => host.teams.find((t) => t.id === id)?.name ?? H.noTeam;
  return (
    <Slip className="p-3">
      <table className="w-full text-sm">
        <tbody>
          {host.people.map((p) => (
            <tr key={p.studentId} className="border-t border-ink/10">
              <td className="font-bold">
                {p.name} {p.online && <span className="text-mint">●</span>} {p.internet && <span className="chip !bg-coral !py-0 text-xs">{H.internetFlag}</span>}
              </td>
              <td className="font-mono text-xs">{p.studentId}</td>
              <td>
                {p.dept} · {p.sem}
              </td>
              <td>{teamName(p.teamId)}</td>
              <td className="flex flex-wrap gap-2 py-1">
                <button
                  type="button"
                  className="text-xs font-bold underline"
                  onClick={() => {
                    const name = prompt(H.renamePrompt, p.name);
                    if (name) void act(EVC.hostMember, { op: "rename", studentId: p.studentId, name });
                  }}
                >
                  {H.renameStudent}
                </button>
                <select
                  className="rounded border border-ink/30 bg-card text-xs"
                  value=""
                  onChange={(e) => e.target.value && act(EVC.hostMember, { op: "move", studentId: p.studentId, teamId: e.target.value })}
                >
                  <option value="">{H.move}</option>
                  {host.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {p.teamId && (
                  <button type="button" className="text-xs font-bold underline" onClick={() => act(EVC.hostMember, { op: "remove", studentId: p.studentId })}>
                    {H.removeStudent}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Slip>
  );
}

function Setup({ host }: { host: HostView }) {
  const [s, setS] = useState(host.settings);
  useEffect(() => setS(host.settings), [host.settings]);
  const S = H.settings;
  const num = (k: "buildMinutes" | "minTeamSize" | "maxTeamSize" | "maxTeams", label: string) => (
    <label className="flex items-center justify-between gap-3 font-bold">
      {label}
      <input className="field w-24 text-center" type="number" value={s[k]} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })} />
    </label>
  );
  const box = (k: "glitch" | "logPrompts" | "allowHostInternet" | "allowCodeEdit", label: string) => (
    <label className="flex items-center gap-2 font-bold">
      <input type="checkbox" checked={s[k] !== false} onChange={(e) => setS({ ...s, [k]: e.target.checked })} /> {label}
    </label>
  );
  return (
    <Slip className="flex max-w-xl flex-col gap-3 p-4">
      {num("buildMinutes", S.buildMinutes)}
      {num("minTeamSize", S.minTeamSize)}
      {num("maxTeamSize", S.maxTeamSize)}
      {num("maxTeams", S.maxTeams)}
      {box("glitch", S.glitch)}
      {box("logPrompts", S.logPrompts)}
      {box("allowHostInternet", S.allowHostInternet)}
      {box("allowCodeEdit", S.allowCodeEdit)}
      <div>
        <div className="font-bold">{S.variants}</div>
        <div className="mt-1 flex flex-wrap gap-3">
          {TILE_IDS.filter((id) => ["countdown", "register", "feedback", "fixit"].includes(id)).map((id) => (
            <label key={id} className="flex items-center gap-1 text-sm font-semibold">
              <input
                type="checkbox"
                checked={(s.variants[id] ?? tileConfig(id).variant) === "simple"}
                onChange={(e) => setS({ ...s, variants: { ...s.variants, [id]: e.target.checked ? "simple" : "full" } })}
              />
              {tileConfig(id).title}
            </label>
          ))}
        </div>
      </div>
      <Btn
        tone="mint"
        onClick={() =>
          act(EVC.hostSettings, {
            buildMinutes: s.buildMinutes,
            minTeamSize: s.minTeamSize,
            maxTeamSize: s.maxTeamSize,
            maxTeams: s.maxTeams,
            glitch: s.glitch,
            logPrompts: s.logPrompts,
            allowHostInternet: s.allowHostInternet,
            allowCodeEdit: s.allowCodeEdit !== false,
            variants: s.variants,
          })
        }
      >
        {S.save}
      </Btn>
    </Slip>
  );
}

function Ai({ host }: { host: HostView }) {
  const A = H.ai;
  const [key, setKey] = useState("");
  const h = host.health;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Slip className="flex flex-col gap-3 p-4">
        <div className="font-black">{A.key}</div>
        <p className="text-sm font-bold">{h.keySet ? `✅ ${A.keySet} (${h.provider})` : `⚠️ ${A.keyMissing}`}</p>
        <input className="field" type="password" placeholder={A.keyPlaceholder} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
        <Btn
          tone="mint"
          disabled={!key.trim()}
          onClick={async () => {
            if (await act(EVC.hostGeminiKey, { key })) setKey("");
          }}
        >
          {A.saveKey}
        </Btn>
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" checked={host.settings.safeMode} onChange={(e) => act(EVC.hostSettings, { safeMode: e.target.checked })} /> {A.safeMode}
        </label>
        {h.autoSafe && <p className="font-bold text-stamp">⚠️ {A.autoSafe}</p>}
        <p className="text-sm font-bold">
          {A.queue(h.queued, h.inFlight)} · {A.perMin(h.asksPerMin)}
        </p>
      </Slip>
      <Slip className="p-4">
        <table className="w-full text-sm">
          <tbody>
            {h.models.map((m) => (
              <tr key={m.id} className="border-t border-ink/10">
                <td className="font-bold">
                  {m.label}
                  <div className="text-xs text-ink-soft">{m.id}</div>
                </td>
                <td>
                  <span className={cx("chip !py-0 text-xs", m.status === "ok" && "!bg-mint", (m.status === "paused" || m.status === "disabled") && "!bg-coral", m.status === "limit" && "!bg-yellow")}>{m.status}</span>
                </td>
                <td className="text-xs">
                  {m.lastMinute}/{m.rpm} /min · {m.usedToday}/{m.rpd} today · {m.errors} errors
                  {m.lastError && <div className="text-stamp">{m.lastError}</div>}
                </td>
                <td>
                  <button type="button" className="text-xs font-bold underline" onClick={() => act(EVC.hostModel, { id: m.id, disabled: m.status !== "disabled" })}>
                    {m.status === "disabled" ? A.enable : A.disable}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Slip>
    </div>
  );
}

function Network({ host, wall }: { host: HostView; wall: WallView }) {
  const N = H.network;
  return (
    <div className="flex flex-col gap-4">
      <Slip className="p-4 font-bold">{host.laptopInternet ? `✅ ${N.laptopInternet}` : host.laptopInternet === false ? `⚠️ ${N.laptopOffline}` : "…"}</Slip>
      <div className="flex flex-wrap gap-4">
        {wall.joinUrls.map((u) => (
          <Slip key={u.url} className="flex w-60 flex-col items-center gap-2 p-3 text-center">
            <Hand className="text-lg">{N.join}</Hand>
            <div className="w-44" dangerouslySetInnerHTML={{ __html: u.qrSvg }} />
            <div className="text-xs font-bold">{u.label}</div>
            <div className="break-all font-mono text-xs">{u.url}</div>
          </Slip>
        ))}
      </div>
      <Slip className="p-3 text-sm">
        <span className="font-bold">{N.dataDir}:</span> <span className="font-mono">{host.dataDir}</span>
      </Slip>
    </div>
  );
}

function Showcase({ host, wall }: { host: HostView; wall: WallView }) {
  const S = H.showcase;
  const published = host.teams.filter((t) => t.publish);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Slip className="flex flex-col gap-3 p-4">
        <div className="font-black">{S.pick}</div>
        <div className="flex flex-wrap gap-2">
          <Btn size="sm" tone={wall.showcaseTeam ? "paper" : "ink"} onClick={() => act(EVC.hostShowcase, { teamId: null })}>
            {S.none}
          </Btn>
          {published.map((t) => (
            <Btn key={t.id} size="sm" tone={wall.showcaseTeam === t.id ? "ink" : "paper"} onClick={() => act(EVC.hostShowcase, { teamId: t.id })}>
              {t.name}
            </Btn>
          ))}
        </div>
        <Btn tone={wall.votingOpen ? "coral" : "mint"} disabled={wall.clock.phase !== "showcase"} onClick={() => act(EVC.hostShowcase, { teamId: wall.showcaseTeam, voting: !wall.votingOpen })}>
          🗳 {wall.votingOpen ? S.votingOff : S.votingOn}
        </Btn>
        <div className="font-black">{S.votes}</div>
        <ul className="text-sm">
          {published.map((t) => (
            <li key={t.id}>
              {t.name}: <b>{host.votes[t.id] ?? 0}</b>
            </li>
          ))}
        </ul>
      </Slip>
      <Slip className="flex flex-col gap-2 p-4">
        <div className="font-black">{S.awards}</div>
        {(wall.awards ?? []).map((a) => (
          <div key={a.id} className="text-sm">
            <b>{a.title}:</b> {a.teamName ?? "—"} <span className="text-ink-soft">{a.detail}</span>
          </div>
        ))}
      </Slip>
    </div>
  );
}
