/**
 * pnpm vibecoding:bots — load test and soak for Tile Rush (spec 16.5), with the mock AI.
 *
 *   Starts its own arena (a throwaway data folder), fills it with simulated teams
 *   of 2, 3 and 4 equally skilled students who really play: open tiles, Ask,
 *   Ask again when a check fails, solve the puzzle, publish, handle the change
 *   request. Then reports the budgets:
 *     arena CPU avg < 40 %, RAM < 500 MB, wall update p95 < 1 s, check p95 < 1.5 s,
 *     no team starved, per-model limits never exceeded, size fairness < 15 %.
 *
 *   --teams 15  --minutes 15 (build clock)  --cooldown 8 (s)  --latency 500-5000 (ms)
 *   --quality 0.7 (share of right answers)  --audience 15 (extra phones on the wall)
 *   --restart 6 (kill + restart the arena at this minute; 0 = never)  --drops 0.05 (per bot, per minute)
 *   --arena <kit>/arena.mjs   test a packed event kit instead of the source
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { io, type Socket } from "socket.io-client";
import { EVC, type HostView, type TeamView, type WallView } from "@iedc/shared/competitions/vibecoding/protocol";
import { MODELS, TASKS } from "@iedc/shared/competitions/vibecoding/config";
import { solvePath } from "@iedc/shared/competitions/vibecoding/puzzle";

const { values: a } = parseArgs({
  options: {
    teams: { type: "string", default: "15" },
    minutes: { type: "string", default: "15" },
    cooldown: { type: "string", default: "8" },
    latency: { type: "string", default: "500-5000" },
    quality: { type: "string", default: "0.7" },
    audience: { type: "string", default: "15" },
    restart: { type: "string", default: "6" },
    drops: { type: "string", default: "0.05" },
    port: { type: "string", default: "4300" },
    /** test a packed event kit: path to its arena.mjs */
    arena: { type: "string" },
  },
});
const PORT = Number(a.port);
const PIN = "1111";
const here = path.dirname(fileURLToPath(import.meta.url));
const arenaDir = path.join(here, "..");
const data = fs.mkdtempSync(path.join(os.tmpdir(), "vc-bots-"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const URL_ = `http://127.0.0.1:${PORT}`;

/* ---------------- the arena under test ---------------- */
let arena: ChildProcess | null = null;
async function startArena(fresh: boolean) {
  const tsx = path.join(path.dirname(createRequire(import.meta.url).resolve("tsx/package.json")), "dist", "cli.mjs");
  const entry = a.arena ? [path.resolve(a.arena)] : [tsx, "src/index.ts"];
  arena = spawn(process.execPath, [...entry, "--port", String(PORT), "--pin", PIN, "--data", data, ...(fresh ? ["--fresh"] : [])], {
    cwd: a.arena ? path.dirname(path.resolve(a.arena)) : arenaDir,
    env: {
      ...process.env,
      VC_AI: "mock",
      VC_MOCK_LATENCY_MS: a.latency,
      VC_MOCK_FAIL: "0.03",
      VC_MOCK_BAD: "0.01",
      VC_MOCK_QUALITY: a.quality,
      VC_COOLDOWN_SEC: a.cooldown,
      VC_SITES_PORT: String(PORT + 1),
    },
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${URL_}/api/health`)).ok) return;
    } catch {
      /* not yet */
    }
    await sleep(200);
  }
  throw new Error("arena did not start");
}

/* ---------------- metrics ---------------- */
const m = {
  cpu: [] as number[],
  rss: [] as number[],
  wallLag: [] as number[],
  checkP95: 0,
  askMs: new Map<string, number[]>(),
  modelOver: [] as string[],
  maxPerMinute: new Map<string, number>(),
};
const pending = new Map<string, { at: number; done: number }>(); // teamId → waiting for the wall to show `done` tiles

/* ---------------- clients ---------------- */
function client(role: "player" | "host" | "screen", token?: string, pin?: string) {
  const s = io(`${URL_}/competitions`, { transports: ["websocket"], forceNew: true, reconnectionDelay: 300, reconnectionDelayMax: 1500 });
  s.on("connect", () => s.emit(EVC.hello, { competition: "vibecoding", role, token, pin }, () => {}));
  return s;
}
const ack = <T = { ok: boolean; error?: string }>(s: Socket, ev: string, p: unknown = {}, ms = 60_000) =>
  s
    .timeout(ms)
    .emitWithAck(ev, p)
    .catch(() => ({ ok: false, error: "timeout" })) as Promise<T>;

interface Bot {
  id: string;
  s: Socket;
  team: TeamView | null;
  teamIdx: number;
  captain: boolean;
}

async function main() {
  await startArena(true);
  console.log(`Arena on ${URL_} (data ${data}). ${a.teams} teams, ${a.minutes} min clock, cooldown ${a.cooldown}s, AI latency ${a.latency} ms, quality ${a.quality}.`);

  const host = client("host", undefined, PIN);
  let hostView: HostView | null = null;
  host.on(EVC.host, (h: HostView) => (hostView = h));
  await new Promise<void>((r) => host.once(EVC.host, () => r()));
  await ack(host, EVC.hostSettings, { buildMinutes: Number(a.minutes), glitch: true, maxTeams: 40 });
  await ack(host, EVC.hostPhase, { phase: "registration" });

  const screen = client("screen");
  let wall: WallView | null = null;
  screen.on(EVC.wall, (w: WallView) => {
    wall = w;
    const now = Date.now();
    for (const t of w.teams) {
      const p = pending.get(t.id);
      if (p && t.tilesDone >= p.done) {
        m.wallLag.push(now - p.at);
        pending.delete(t.id);
      }
    }
  });
  for (let i = 0; i < Number(a.audience); i++) client("screen");

  // teams of 2, 3, 4 (equal skill)
  const sizes = Array.from({ length: Number(a.teams) }, (_, i) => [2, 3, 4][i % 3]);
  const bots: Bot[] = [];
  for (let ti = 0; ti < sizes.length; ti++) {
    let code = "";
    for (let mi = 0; mi < sizes[ti]; mi++) {
      const id = `B${ti}X${mi}`;
      const token = `bot-token-${id}-xxxxxxxx`;
      const s = client("player", token);
      const bot: Bot = { id, s, team: null, teamIdx: ti, captain: mi === 0 };
      s.on(EVC.team, (t: TeamView | null) => (bot.team = t));
      await new Promise<void>((r) => (s.connected ? r() : s.once("connect", () => r())));
      await sleep(30);
      const j = await ack(s, EVC.join, { token, studentId: id, pin: "1234", name: `Bot ${ti}.${mi}`, sem: "S3", dept: "CSE", avatar: ti * 10 + mi });
      if (!j.ok) throw new Error(`join failed: ${j.error}`);
      if (mi === 0) {
        await ack(s, EVC.teamCreate, { name: `Bots ${String(ti + 1).padStart(2, "0")} (${sizes[ti]})` });
        await sleep(200);
        code = bot.team!.code;
      } else await ack(s, EVC.teamJoin, { code });
      bots.push(bot);
    }
  }
  console.log(`${bots.length} bots in ${sizes.length} teams (+${a.audience} audience phones, 1 screen, 1 host).`);
  await ack(host, EVC.hostPhase, { phase: "build" });
  const t0 = Date.now();
  const buildMs = Number(a.minutes) * 60_000;

  // sample the arena
  let last: { at: number; cpuMs: number } | null = null;
  const sampler = setInterval(async () => {
    try {
      const h = (await (await fetch(`${URL_}/api/health`)).json()) as { cpuMs: number; rss: number };
      const now = Date.now();
      if (last && h.cpuMs >= last.cpuMs) m.cpu.push(((h.cpuMs - last.cpuMs) / (now - last.at)) * 100);
      last = { at: now, cpuMs: h.cpuMs };
      m.rss.push(h.rss);
      const hv = hostView as HostView | null;
      if (hv) {
        m.checkP95 = Math.max(m.checkP95, hv.health.checkP95Ms);
        for (const mh of hv.health.models) {
          m.maxPerMinute.set(mh.id, Math.max(m.maxPerMinute.get(mh.id) ?? 0, mh.lastMinute));
          if (mh.lastMinute > mh.rpm) m.modelOver.push(`${mh.id} ${mh.lastMinute}/${mh.rpm}`);
        }
      }
    } catch {
      last = null; // the arena is restarting
    }
  }, 2000);

  // a forced restart in the middle
  const restartAt = Number(a.restart) * 60_000;
  let restarted = false;
  const restarter = restartAt
    ? setTimeout(async () => {
        console.log(`  ⟳ killing the arena at minute ${a.restart}…`);
        arena?.kill("SIGKILL");
        await sleep(1500);
        await startArena(false);
        restarted = true;
        console.log("  ⟳ arena restarted from its saved state");
      }, restartAt)
    : null;

  const live = () => Date.now() - t0 < buildMs + 5000;

  async function play(bot: Bot) {
    let mine: string | null = null;
    while (live()) {
      await sleep(rand(300, 900));
      // random phone drops
      if (Math.random() < Number(a.drops) / 60) {
        bot.s.disconnect();
        await sleep(rand(2000, 5000));
        bot.s.connect();
        continue;
      }
      const t = bot.team;
      if (!t || !bot.s.connected) continue;
      if (t.puzzle && t.puzzle.solvedAt == null) {
        if (!bot.captain) continue;
        const path_ = solvePath(t.puzzle.board);
        if (path_.length) await ack(bot.s, EVC.puzzleMove, { cell: path_[0], version: t.puzzle.version });
        await sleep(rand(300, 900));
        continue;
      }
      if (t.puzzle?.solvedAt != null && !t.publish) {
        if (bot.captain) await ack(bot.s, EVC.publishGo, {}, 120_000);
        continue;
      }
      const cr = t.changeRequest && t.changeRequest.doneAt == null ? t.changeRequest : null;
      if (cr) {
        if (!bot.captain) continue;
        if (Date.now() < t.cooldownUntil || t.askPending) continue;
        await ack(bot.s, EVC.tileOpen, { tileId: "hero" });
        const phrase = TASKS.changeRequests.find((c) => cr.text.includes(c.phrase))!.phrase;
        const r = await ack<{ ok: boolean }>(bot.s, EVC.askSend, { tileId: "hero", text: `Please add the line "${phrase}" to the page` }, 120_000);
        if (r.ok) await ack(bot.s, EVC.publishGo, {}, 120_000);
        continue;
      }
      if (t.publish) continue;
      // pick a tile: keep mine until done, else a free one
      const tiles = t.tiles.filter((x) => x.id !== "warmup" && !x.done);
      let tile = tiles.find((x) => x.id === mine && (!x.holder || x.holder.studentId === bot.id));
      if (!tile) tile = tiles.find((x) => !x.holder);
      if (!tile) continue;
      if (tile.holder?.studentId !== bot.id) {
        const o = await ack(bot.s, EVC.tileOpen, { tileId: tile.id });
        if (!o.ok) continue;
      }
      mine = tile.id;
      if (Date.now() < t.cooldownUntil || t.askPending) continue;
      await sleep(rand(2000, 6000)); // typing the Ask
      const before = Date.now();
      const doneBefore = t.tiles.filter((x) => x.done).length;
      const r = await ack<{ ok: boolean; check?: { passed: number; total: number } }>(bot.s, EVC.askSend, { tileId: tile.id, text: "Please make this section as the brief says" }, 120_000);
      if (r.ok) {
        const list = m.askMs.get(t.id) ?? [];
        list.push(Date.now() - before);
        m.askMs.set(t.id, list);
        if (r.check && r.check.passed === r.check.total) pending.set(t.id, { at: Date.now(), done: doneBefore });
      }
    }
  }

  await Promise.all(bots.map((b) => play(b)));
  clearInterval(sampler);
  if (restarter) clearTimeout(restarter);
  await ack(host, EVC.hostPhase, { phase: "frozen" });
  await sleep(1500);

  /* ---------------- report ---------------- */
  const w = wall as WallView | null;
  const hv = hostView as HostView | null;
  const q = (xs: number[], p: number) => (xs.length ? [...xs].sort((x, y) => x - y)[Math.min(xs.length - 1, Math.floor(p * xs.length))] : 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const teams = hv?.teams ?? [];
  const bySize = new Map<number, { raw: number[]; adj: number[] }>();
  for (const t of teams) {
    if (!t.publish) continue;
    const g = bySize.get(t.members.length) ?? { raw: [], adj: [] };
    const factor = ({ 2: 0.85, 3: 1, 4: 1.15 } as Record<number, number>)[t.members.length] ?? 1;
    g.raw.push(t.publish.firstAt / 60_000);
    g.adj.push((t.publish.firstAt * factor) / 60_000);
    bySize.set(t.members.length, g);
  }
  const adjMeans = [...bySize.values()].map((g) => avg(g.adj));
  const spread = adjMeans.length > 1 ? (Math.max(...adjMeans) - Math.min(...adjMeans)) / Math.min(...adjMeans) : 0;
  const askAll = [...m.askMs.values()].flat();
  const perTeamP95 = [...m.askMs.entries()].map(([id, xs]) => ({ id, p95: q(xs, 0.95), n: xs.length }));
  const starved = teams.filter((t) => !(m.askMs.get(t.id)?.length));
  const rows: [string, string, boolean][] = [
    ["Arena CPU (avg)", `${avg(m.cpu).toFixed(1)} % (max ${Math.max(0, ...m.cpu).toFixed(0)} %)`, avg(m.cpu) < 40],
    ["Arena RAM (max)", `${(Math.max(0, ...m.rss) / 1024 / 1024).toFixed(0)} MB`, Math.max(0, ...m.rss) < 500 * 1024 * 1024],
    ["Wall update p95", `${q(m.wallLag, 0.95)} ms (${m.wallLag.length} tile completions)`, q(m.wallLag, 0.95) < 1000],
    ["Check run p95", `${m.checkP95} ms`, m.checkP95 < 1500],
    ["Ask round-trip p50 / p95", `${(q(askAll, 0.5) / 1000).toFixed(1)} s / ${(q(askAll, 0.95) / 1000).toFixed(1)} s`, true],
    ["No team starved", starved.length ? `starved: ${starved.map((t) => t.name).join(", ")}` : `every team was served (worst team p95 ${(Math.max(0, ...perTeamP95.map((x) => x.p95)) / 1000).toFixed(1)} s)`, starved.length === 0],
    ["Model limits never exceeded", m.modelOver.length ? m.modelOver.slice(0, 3).join("; ") : [...m.maxPerMinute].map(([id, n]) => `${id} ≤${n}/${MODELS.models.find((x) => x.id === id)?.rpm}`).join(", "), m.modelOver.length === 0],
    ["Size fairness (adjusted publish)", [...bySize].map(([n, g]) => `${n}: raw ${avg(g.raw).toFixed(1)} → adj ${avg(g.adj).toFixed(1)} min (${g.raw.length})`).join("; ") + (adjMeans.length > 1 ? ` · spread ${(spread * 100).toFixed(0)} %` : " · n/a (fewer than 2 sizes published)"), adjMeans.length < 2 || spread < 0.15],
    ["Restart mid-event", restartAt ? (restarted ? "arena killed and restored; bots reconnected" : "not reached") : "skipped", !restartAt || restarted],
  ];
  const published = teams.filter((t) => t.publish).length;
  const crDone = teams.filter((t) => t.changeRequest?.doneAt != null).length;
  console.log(`\nResults: ${published}/${teams.length} teams published, ${crDone} handled the change request, ${teams.reduce((n, t) => n + t.asksUsed, 0)} Asks.`);
  for (const [k, v, ok] of rows) console.log(`  ${ok ? "✅" : "❌"} ${k.padEnd(34)} ${v}`);
  console.log(`\nTop 3: ${(w?.teams ?? []).slice(0, 3).map((t) => `${t.name} ${t.score}`).join(" · ")}`);
  for (const s of [host, screen, ...bots.map((b) => b.s)]) s.disconnect();
  arena?.kill();
  process.exit(rows.every((r) => r[2]) ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  arena?.kill();
  process.exit(1);
});
