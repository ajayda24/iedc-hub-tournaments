"use client";
import { useEffect, useMemo, useState } from "react";
import { GAME_META, GAME_ORDER } from "@iedc/shared/games/meta";
import type { Difficulty, GameId } from "@iedc/shared/games/types";
import { EV, type EventConfig, type HostPlayer, type HostState, type PublicState, type RoundConfig } from "@iedc/shared/protocol";
import { connectArena, emitAck, reconnectArena, useArena } from "@/net/arena";
import { useServerNow } from "@/net/useNow";
import { cx, fmtClock } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Feed } from "@/ui/Feed";
import { Btn, COLOR, ConnDot, Hand, Slip } from "@/ui/kit";
import { DeptBoard, Leaderboard } from "@/ui/Leaderboard";
import { Mascot } from "@/ui/Mascot";
import { TimerBar } from "@/ui/Timer";
import { ANAGRAM_PACK_OPTIONS, DEFAULT_CUSTOM_WORDS, DIFFICULTY_LABEL } from "@iedc/data/games";
import { SCORING } from "@iedc/data/rules";
import { host as H } from "@iedc/data/copy/host";

const PACKS = ANAGRAM_PACK_OPTIONS;
const DIFF_LABEL = DIFFICULTY_LABEL;

type Ack = { ok: boolean; error?: string };

export function HostApp() {
  const { host, state, helloDone, helloError, conn } = useArena();
  const [pin, setPin] = useState("");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("ba:pin");
    if (saved) {
      setTried(true);
      connectArena({ role: "host", pin: saved });
    }
  }, []);

  const login = () => {
    sessionStorage.setItem("ba:pin", pin);
    setTried(true);
    reconnectArena({ role: "host", pin });
  };

  if (!host || !state) {
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
          placeholder={H.pinPlaceholder}
        />
        <Btn size="lg" tone="mint" className="w-full" onClick={login} disabled={pin.length < 4}>
          {H.enter}
        </Btn>
        {tried && helloDone && helloError && <p className="hand text-xl text-stamp">{helloError}</p>}
        {tried && conn === "offline" && <p className="hand text-xl text-stamp">{H.cantReach}</p>}
      </main>
    );
  }
  return <Console host={host} state={state} />;
}

/* ------------------------------------------------------------------ */

async function act(event: string, payload?: unknown): Promise<Ack> {
  try {
    const res = await emitAck<Ack>(event, payload);
    if (!res.ok && res.error) alert(res.error);
    return res;
  } catch (e) {
    alert(e instanceof Error ? e.message : H.failed);
    return { ok: false };
  }
}

function Console({ host, state }: { host: HostState; state: PublicState }) {
  const conn = useArena((s) => s.conn);
  const [tab, setTab] = useState<"players" | "flags" | "network" | "board">("players");
  const flagsNew = host.flags.filter((f) => Date.now() - f.at < 5 * 60_000).length;

  const exportCsv = async () => {
    const res = await emitAck<{ ok: boolean; csv: string; savedTo?: string }>(EV.hostExport);
    const blob = new Blob([res.csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${host.config.eventName.replace(/\W+/g, "-")}${H.csvFileSuffix}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="min-h-dvh pb-16 md:pl-16">
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5">
          <Mascot mood="idle" size={34} bob={false} />
          <div className="mr-auto leading-tight">
            <div className="text-xl font-black">{host.config.eventName}</div>
            <ConnDot conn={conn} />
          </div>
          <span className="chip">
            {H.online(state.onlineCount, state.playerCount)}
          </span>
          <a className="sticker !bg-sky !px-3 !py-1.5 text-sm" href="/screen/" target="_blank" rel="noreferrer">
            {H.openScreen}
          </a>
          <Btn size="sm" tone="paper" onClick={exportCsv}>
            {H.exportCsv}
          </Btn>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-6">
          <Controls host={host} state={state} />
          <Playlist host={host} />
          <Settings host={host} />
          <Danger />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["players", H.tabPlayers(host.players.length)],
                ["flags", H.tabFlags(flagsNew)],
                ["network", H.tabNetwork],
                ["board", H.tabBoard],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={cx("chip !px-3 !py-1.5", tab === k && "!bg-ink !text-paper", k === "flags" && flagsNew > 0 && tab !== k && "!bg-coral")}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "players" && <Players players={host.players} />}
          {tab === "flags" && <Flags host={host} />}
          {tab === "network" && <Network host={host} />}
          {tab === "board" && <Board />}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- controls ----------------------------- */

function Controls({ host, state }: { host: HostState; state: PublicState }) {
  const now = useServerNow(250);
  const round = state.round;
  const next = host.config.rounds[host.roundIndex + 1];
  const live = state.phase === "countdown" || state.phase === "playing";
  return (
    <Slip taped className="flex flex-col gap-4 px-4 pb-4 pt-6" style={{ background: "var(--color-card)" }}>
      <div className="flex items-center gap-2">
        <span className="chip !bg-yellow uppercase">{state.phase}</span>
        {round && live && (
          <span className="font-bold">
            R{round.index + 1} · {round.title} · {DIFF_LABEL[round.config.difficulty]}
          </span>
        )}
        {host.config.format === "knockout" && <span className="chip !bg-coral">{H.knockoutChip(host.config.knockoutPct)}</span>}
      </div>

      {live && round && (
        <>
          {state.phase === "countdown" ? (
            <div className="text-2xl font-black">{H.startingIn(Math.max(0, Math.ceil((round.startsAt - now) / 1000)))}</div>
          ) : (
            <TimerBar endsAt={round.endsAt} total={round.config.timeLimitSec * 1000} now={now} paused={round.pausedRemainingMs} big />
          )}
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black tabular-nums">{round.solvedCount}</span>
            <span className="font-bold text-pencil">{H.solvedOf(round.activeCount)}</span>
            {round.firstSolver && <Hand className="ml-auto text-lg">{H.firstBlood(round.firstSolver)}</Hand>}
          </div>
          <div className="flex flex-wrap gap-2">
            {state.phase === "playing" &&
              (host.paused ? (
                <Btn tone="mint" onClick={() => act(EV.hostResume)}>
                  {H.resume}
                </Btn>
              ) : (
                <Btn tone="paper" onClick={() => act(EV.hostPause)}>
                  {H.pause}
                </Btn>
              ))}
            <Btn tone="coral" onClick={() => confirm(H.confirmEndRound) && act(EV.hostEnd)}>
              {H.endRound}
            </Btn>
          </div>
        </>
      )}

      {!live && (
        <div className="flex flex-wrap gap-2">
          {next ? (
            <Btn size="lg" tone="mint" onClick={() => act(EV.hostStart)} disabled={state.playerCount === 0}>
              {H.startRound(host.roundIndex + 2, GAME_META[next.game].title, DIFF_LABEL[next.difficulty])}
            </Btn>
          ) : (
            <Hand className="self-center text-lg">{H.playlistDone}</Hand>
          )}
          {state.phase !== "podium" && (
            <Btn tone="yellow" onClick={() => act(EV.hostPodium)} disabled={state.roundsPlayed === 0}>
              {H.showPodium}
            </Btn>
          )}
          {state.phase !== "lobby" && (
            <Btn tone="paper" onClick={() => act(EV.hostLobby)}>
              {H.backToLobby}
            </Btn>
          )}
        </div>
      )}
      {state.playerCount === 0 && <Hand className="text-base">{H.waitingForPlayers}</Hand>}
    </Slip>
  );
}

/* ---------------------------- playlist ----------------------------- */

const newId = () => `r${Math.random().toString(36).slice(2, 7)}`;

function Playlist({ host }: { host: HostState }) {
  const [draft, setDraft] = useState<RoundConfig[]>(host.config.rounds);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setDraft(host.config.rounds);
  }, [host.config.rounds, dirty]);

  const edit = (i: number, patch: Partial<RoundConfig>) => {
    setDraft((d) => d.map((r, k) => (k === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const move = (i: number, by: number) => {
    setDraft((d) => {
      const j = i + by;
      if (j < 0 || j >= d.length) return d;
      const out = d.slice();
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
    setDirty(true);
  };
  const save = async () => {
    const res = await act(EV.hostConfig, { ...host.config, rounds: draft });
    if (res.ok) setDirty(false);
  };
  const add = (game: GameId) => {
    setDraft((d) => [...d, { id: newId(), game, difficulty: "easy", timeLimitSec: GAME_META[game].defaultTimeSec.easy }]);
    setDirty(true);
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="mr-auto text-2xl font-black">{H.playlist}</h2>
        {dirty && (
          <>
            <Btn size="sm" tone="paper" onClick={() => (setDraft(host.config.rounds), setDirty(false))}>
              {H.discard}
            </Btn>
            <Btn size="sm" tone="mint" onClick={save}>
              {H.saveChanges}
            </Btn>
          </>
        )}
      </div>
      {draft.map((r, i) => {
        const played = i <= host.roundIndex;
        const meta = GAME_META[r.game];
        return (
          <div
            key={r.id}
            className={cx("rounded-lg border-2 border-ink bg-card p-3 shadow-[3px_3px_0_0_var(--color-ink)]", played && "opacity-60")}
            style={{ borderLeft: `10px solid ${COLOR[meta.color]}` }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-7 font-black">R{i + 1}</span>
              <select
                className="field !w-auto !py-1.5"
                value={r.game}
                onChange={(e) => {
                  const g = e.target.value as GameId;
                  edit(i, { game: g, timeLimitSec: GAME_META[g].defaultTimeSec[r.difficulty], options: undefined });
                }}
              >
                {GAME_ORDER.map((g) => (
                  <option key={g} value={g}>
                    {GAME_META[g].title}
                  </option>
                ))}
              </select>
              <div className="flex overflow-hidden rounded-lg border-2 border-ink">
                {(["easy", "med", "hard"] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => edit(i, { difficulty: d, timeLimitSec: GAME_META[r.game].defaultTimeSec[d] })}
                    className={cx("px-2.5 py-1 text-sm font-bold", r.difficulty === d ? "bg-ink text-paper" : "bg-card")}
                  >
                    {DIFF_LABEL[d]}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1 text-sm font-bold">
                <input
                  type="number"
                  min={20}
                  max={1800}
                  step={10}
                  className="field !w-20 !px-2 !py-1"
                  value={r.timeLimitSec}
                  onChange={(e) => edit(i, { timeLimitSec: Math.max(20, Number(e.target.value) || 60) })}
                />
                {H.seconds} <span className="text-pencil">({fmtClock(r.timeLimitSec * 1000)})</span>
              </label>
              <div className="ml-auto flex gap-1">
                <button type="button" className="chip !px-2" onClick={() => move(i, -1)} aria-label={H.moveUp}>
                  ↑
                </button>
                <button type="button" className="chip !px-2" onClick={() => move(i, 1)} aria-label={H.moveDown}>
                  ↓
                </button>
                <button
                  type="button"
                  className="chip !px-2 !text-stamp"
                  onClick={() => {
                    setDraft((d) => d.filter((_, k) => k !== i));
                    setDirty(true);
                  }}
                  aria-label={H.removeRound}
                >
                  ✕
                </button>
              </div>
            </div>
            {r.game === "anagram" && (
              <div className="mt-2 flex flex-wrap items-start gap-2">
                <select
                  className="field !w-auto !py-1.5 text-sm"
                  value={r.options?.customWords?.length ? "custom" : r.options?.pack ?? "mixed"}
                  onChange={(e) => edit(i, { options: e.target.value === "custom" ? { customWords: [...DEFAULT_CUSTOM_WORDS] } : { pack: e.target.value } })}
                >
                  {PACKS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                {r.options?.customWords && (
                  <textarea
                    className="field min-h-[3rem] flex-1 !py-1.5 text-sm"
                    placeholder={H.customWordsPlaceholder}
                    defaultValue={r.options.customWords.join(", ")}
                    onBlur={(e) => edit(i, { options: { customWords: e.target.value.split(/[\s,]+/).filter(Boolean) } })}
                  />
                )}
              </div>
            )}
            {!dirty && !played && i !== host.roundIndex + 1 && (
              <button type="button" className="hand mt-1 text-base text-pencil underline" onClick={() => act(EV.hostStart, { index: i })}>
                {H.playNext}
              </button>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Hand className="self-center text-lg">{H.add}</Hand>
        {GAME_ORDER.map((g) => (
          <Btn key={g} size="sm" tone={GAME_META[g].color} onClick={() => add(g)}>
            + {GAME_META[g].title}
          </Btn>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------- settings ----------------------------- */

function Settings({ host }: { host: HostState }) {
  const [cfg, setCfg] = useState<EventConfig>(host.config);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setCfg(host.config);
  }, [host.config, dirty]);
  const patch = (p: Partial<EventConfig>) => {
    setCfg((c) => ({ ...c, ...p }));
    setDirty(true);
  };
  const save = async () => {
    const res = await act(EV.hostConfig, { ...cfg, rounds: host.config.rounds });
    if (res.ok) setDirty(false);
  };
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center">
        <h2 className="mr-auto text-2xl font-black">{H.settings}</h2>
        {dirty && (
          <Btn size="sm" tone="mint" onClick={save}>
            {H.saveSettings}
          </Btn>
        )}
      </div>
      <div className="grid gap-3 rounded-lg border-2 border-ink bg-card p-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-bold">{H.eventName}</span>
          <input className="field" maxLength={60} value={cfg.eventName} onChange={(e) => patch({ eventName: e.target.value })} />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold">{H.format}</span>
          <div className="flex gap-2">
            {(["classic", "knockout"] as const).map((f) => (
              <button key={f} type="button" onClick={() => patch({ format: f })} className={cx("chip !px-3 !py-1.5", cfg.format === f && "!bg-ink !text-paper")}>
                {H.formats[f]}
              </button>
            ))}
          </div>
        </div>
        {cfg.format === "knockout" && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-bold">{H.knockoutPct(cfg.knockoutPct)}</span>
            <input type="range" min={5} max={75} step={5} value={cfg.knockoutPct} onChange={(e) => patch({ knockoutPct: Number(e.target.value) })} />
          </label>
        )}
        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" className="h-5 w-5 accent-ink" checked={cfg.blockInternet} onChange={(e) => patch({ blockInternet: e.target.checked })} />
          <span className="font-bold">{H.blockInternet}</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">{H.penaltyAt(SCORING.strikePenalty)}</span>
          <input type="number" min={1} max={10} className="field !py-1.5" value={cfg.strikePenaltyAt} onChange={(e) => patch({ strikePenaltyAt: Number(e.target.value) || 2 })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">{H.lockAt}</span>
          <input type="number" min={1} max={10} className="field !py-1.5" value={cfg.strikeLockAt} onChange={(e) => patch({ strikeLockAt: Number(e.target.value) || 3 })} />
        </label>
        <Hand className="text-sm sm:col-span-2">{H.strikeHelp}</Hand>
      </div>
    </section>
  );
}

function Danger() {
  return (
    <section className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-dashed border-stamp p-3">
      <span className="mr-auto font-black text-stamp">{H.danger}</span>
      <Btn size="sm" tone="paper" onClick={() => confirm(H.confirmResetScores) && act(EV.hostReset, { keepPlayers: true })}>
        {H.resetScores}
      </Btn>
      <Btn size="sm" tone="coral" onClick={() => confirm(H.confirmNewEvent) && act(EV.hostReset, { keepPlayers: false })}>
        {H.newEvent}
      </Btn>
    </section>
  );
}

/* ----------------------------- players ----------------------------- */

function Players({ players }: { players: HostPlayer[] }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? players.filter((p) => `${p.name} ${p.dept} ${p.sem}`.toLowerCase().includes(s)) : players;
  }, [players, q]);
  return (
    <div className="flex flex-col gap-2">
      <input className="field !py-2" placeholder={H.search} value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.length === 0 && <Hand className="py-6 text-center text-lg">{H.nobody}</Hand>}
      {shown.map((p) => (
        <div
          key={p.id}
          className={cx(
            "flex flex-wrap items-center gap-2 rounded-lg border-2 border-ink bg-card px-2.5 py-2",
            (p.internet || p.strikes > 0) && "!border-stamp",
            p.kicked && "opacity-50",
          )}
        >
          <span className="w-7 text-center font-black">{p.kicked ? "–" : p.rank}</span>
          <span className="relative">
            <Avatar seed={p.avatar} size={32} />
            <span className={cx("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink", p.online ? "bg-ok" : "bg-pencil")} />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate font-bold">{p.name}</div>
            <div className="text-xs text-pencil">
              {p.dept} · {p.sem} · {p.ip}
              {p.rtt != null && ` · ${p.rtt}ms`}
            </div>
          </div>
          {p.internet && <span className="chip !bg-coral text-xs">{H.internetChip}</span>}
          {p.strikes > 0 && <span className="chip !border-stamp text-xs !text-stamp">{H.strikes(p.strikes)}</span>}
          {p.roundStatus !== "idle" && <span className="chip text-xs">{p.roundStatus}</span>}
          <span className="w-14 text-right font-black tabular-nums">{p.score}</span>
          <div className="flex gap-1">
            <button type="button" className="chip !px-1.5 text-xs" onClick={() => act(EV.hostAdjust, { id: p.id, delta: H.adjustStep })}>
              +{H.adjustStep}
            </button>
            <button type="button" className="chip !px-1.5 text-xs" onClick={() => act(EV.hostAdjust, { id: p.id, delta: -H.adjustStep })}>
              −{H.adjustStep}
            </button>
            {(p.strikes > 0 || p.internet || p.kicked || p.roundStatus === "locked") && (
              <button type="button" className="chip !bg-mint !px-1.5 text-xs" onClick={() => act(EV.hostUnblock, { id: p.id })}>
                {H.unblock}
              </button>
            )}
            {!p.kicked && (
              <button type="button" className="chip !px-1.5 text-xs !text-stamp" onClick={() => confirm(H.confirmKick(p.name)) && act(EV.hostKick, { id: p.id })}>
                {H.kick}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Flags({ host }: { host: HostState }) {
  if (!host.flags.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        <Mascot mood="happy" size={70} />
        <Hand className="text-xl">{H.noFlags}</Hand>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {host.flags.map((f, i) => (
        <div key={`${f.at}-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-ink bg-card px-2.5 py-1.5 text-sm">
          <span className="w-14 tabular-nums text-pencil">{new Date(f.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
          <span className={cx("chip text-xs", f.kind === "internet" ? "!bg-coral" : "!bg-yellow")}>{f.kind}</span>
          <b>{f.name}</b>
          <span className="flex-1 text-ink-soft">{f.detail}</span>
          <span className={cx("chip text-xs", f.action === "lock" && "!bg-stamp !text-paper")}>{f.action}</span>
          <button type="button" className="chip !bg-mint !px-1.5 text-xs" onClick={() => act(EV.hostUnblock, { id: f.playerId })}>
            {H.unblock}
          </button>
        </div>
      ))}
    </div>
  );
}

function Network({ host }: { host: HostState }) {
  const { network } = host;
  return (
    <div className="flex flex-col gap-4">
      {network.internet === true && (
        <div className="slip flex items-center gap-3 !bg-coral px-4 py-3">
          <Mascot mood="shock" size={50} bob={false} />
          <div>
            <div className="text-lg font-black">{H.laptopHasInternet}</div>
            <div className="text-sm font-semibold">{H.laptopHasInternetBody}</div>
          </div>
        </div>
      )}
      {network.internet === false && <div className="chip self-start !bg-mint">{H.laptopOffline}</div>}

      <div className="grid gap-3 sm:grid-cols-2">
        {network.interfaces.length === 0 && <Hand className="text-lg">{H.noNetwork}</Hand>}
        {network.interfaces.map((i) => (
          <div key={i.url} className="slip flex flex-col items-center gap-2 p-3 text-center">
            <span className="chip !bg-yellow">{i.label}</span>
            <div className="w-40" dangerouslySetInnerHTML={{ __html: i.qrSvg }} />
            <code className="text-sm font-bold">{i.url}</code>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-1 font-black">{H.perIp}</h3>
        <Hand className="block text-sm">{H.perIpHint}</Hand>
        <div className="mt-2 flex flex-wrap gap-2">
          {network.groups.map((g) => (
            <span key={g.ip} className={cx("chip", g.count > H.perIpWarnAt && "!bg-coral")}>
              {g.ip} · {g.count}
            </span>
          ))}
        </div>
      </div>
      <details className="rounded-lg border-2 border-ink bg-card p-3 text-sm">
        <summary className="cursor-pointer font-black">{H.cheatSheet}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {H.cheatSheetTips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Board() {
  const { lb, feed } = useArena();
  const [t, setT] = useState<"p" | "d">("p");
  return (
    <div className="flex flex-col gap-4">
      <Feed items={feed} max={6} />
      <div className="flex gap-2">
        <button type="button" className={cx("chip", t === "p" && "!bg-ink !text-paper")} onClick={() => setT("p")}>
          {H.boardPlayers}
        </button>
        <button type="button" className={cx("chip", t === "d" && "!bg-ink !text-paper")} onClick={() => setT("d")}>
          {H.boardDepts}
        </button>
      </div>
      {lb && (t === "p" ? <Leaderboard entries={lb.entries} showStatus /> : <DeptBoard depts={lb.depts} />)}
    </div>
  );
}
