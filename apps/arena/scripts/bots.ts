/**
 * Load / dry-run simulator: N fake students join the arena and actually play.
 * They solve puzzles with the same engines (Sudoku solver, Wordle filtering,
 * dictionary anagram lookup, Countdown search), at human-ish speeds, and some
 * drop and reconnect to exercise rejoin.
 *
 *   pnpm bots --n 80 --url http://localhost:4000 [--skill 0.7] [--churn 0.05]
 *
 * Start rounds from the host console as usual and watch the board move.
 */
import { parseArgs } from "node:util";
import { io, type Socket } from "socket.io-client";
import {
  ANAGRAM_PACKS,
  DEPARTMENTS,
  EV,
  SEMESTERS,
  WORDHUNT_ANSWERS,
  createRng,
  scoreGuess,
  solveCrunch,
  solveSudoku,
  type HelloAck,
  type JoinAck,
  type LbMessage,
  type MeState,
  type PublicState,
  type SubmitAck,
} from "@iedc/shared";

const { values } = parseArgs({
  options: {
    n: { type: "string", default: "40" },
    url: { type: "string", default: "http://localhost:4000" },
    skill: { type: "string", default: "0.7" },
    churn: { type: "string", default: "0.03" },
  },
});
const N = Number(values.n);
const URL = values.url!;
const SKILL = Number(values.skill);
const CHURN = Number(values.churn);

const FIRST = ["Anjali", "Rahul", "Fathima", "Arjun", "Meera", "Nihal", "Sneha", "Vishnu", "Aisha", "Gokul", "Devika", "Akhil", "Riya", "Sanjay", "Hiba", "Adarsh", "Nandana", "Joel", "Amal", "Diya"];
const LAST = ["Nair", "K", "Menon", "P", "Joseph", "Thomas", "S", "Pillai", "Varghese", "Rahman", "Krishnan", "George", "M", "Babu"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rng = createRng(Date.now() >>> 0);

/* ---------------- tiny solvers that only see what a player sees ---------------- */

const anagramIndex = new Map<string, string>();
for (const p of ANAGRAM_PACKS) for (const w of p.words) anagramIndex.set([...w].sort().join(""), w);

function wordleCandidates(history: { word: string; tiles: string[] }[]) {
  return WORDHUNT_ANSWERS.filter((cand) => history.every((h) => scoreGuess(h.word, cand).join("") === h.tiles.join("")));
}

/* ---------------- one bot ---------------- */

interface BotStats {
  joined: boolean;
  submits: number;
  lbLatency: number[];
}

async function bot(i: number, stats: BotStats) {
  const token = `bot-${i}-${Math.random().toString(36).slice(2, 10)}`;
  const name = `${rng.pick(FIRST)} ${rng.pick(LAST)} ${i}`;
  const dept = rng.pick(DEPARTMENTS.slice(0, 8));
  const sem = rng.pick(SEMESTERS);
  const speed = 0.5 + rng.next() * 1.5; // per-bot pace multiplier
  let state: PublicState | null = null;
  let me: MeState | null = null;
  let playingRound: string | null = null;
  let socket: Socket;

  const connect = () =>
    new Promise<void>((resolve) => {
      socket = io(URL, { transports: ["websocket"], reconnection: true, forceNew: true });
      socket.on("connect", async () => {
        const hello: HelloAck = await socket.timeout(5000).emitWithAck(EV.hello, { role: "player", token });
        if (!hello.me) {
          const res: JoinAck = await socket.timeout(5000).emitWithAck(EV.join, { token, studentId: `BOT${String(i).padStart(4, "0")}`, pin: "1234", name, sem, dept, avatar: rng.int(1_000_000) });
          if (!res.ok) console.error(`bot ${i} join failed: ${res.error}`);
          me = res.me ?? null;
        } else me = hello.me;
        stats.joined = true;
        resolve();
      });
      socket.on(EV.state, (s: PublicState) => {
        state = s;
        if (s.phase === "playing" && s.round && playingRound !== s.round.id && !me?.eliminated) {
          playingRound = s.round.id;
          void play(s).catch(() => {});
        }
      });
      socket.on(EV.me, (m: MeState) => (me = m));
      socket.on(EV.lb, (_lb: LbMessage) => {
        if (lastSubmitAt) {
          stats.lbLatency.push(Date.now() - lastSubmitAt);
          lastSubmitAt = 0;
        }
      });
    });

  let lastSubmitAt = 0;
  const submit = async (roundId: string, sub: unknown): Promise<SubmitAck> => {
    stats.submits++;
    lastSubmitAt = Date.now();
    try {
      return await socket.timeout(5000).emitWithAck(EV.submit, { roundId, sub });
    } catch {
      return { ok: false, error: "timeout" };
    }
  };
  const live = (id: string) => state?.phase === "playing" && state.round?.id === id;
  const think = (ms: number) => sleep(ms * speed * (0.6 + rng.next() * 0.8));

  async function play(s: PublicState) {
    const r = s.round!;
    const id = r.id;
    const pub = r.pub as any;
    const good = () => rng.next() < SKILL;
    await think(2500);

    if (r.config.game === "anagram") {
      const order: number[] = rng.shuffle(pub.scrambles.map((_: string, k: number) => k));
      for (const k of order) {
        if (!live(id)) return;
        await think(2500 + pub.scrambles[k].length * 500);
        const answer = good() ? anagramIndex.get([...pub.scrambles[k].toLowerCase()].sort().join("")) ?? "nope" : "wrong";
        await submit(id, { index: k, answer });
      }
    } else if (r.config.game === "sudoku") {
      const sol = solveSudoku(pub.givens, pub.size, pub.boxR, pub.boxC)!;
      const grid = pub.givens.slice();
      const empty: number[] = grid.map((v: number, k: number) => (v ? -1 : k)).filter((k: number) => k >= 0);
      for (const [n, k] of rng.shuffle(empty).entries()) {
        if (!live(id)) return;
        await think(pub.size === 9 ? 2500 : 1800);
        grid[k] = good() || n < empty.length - 2 ? sol[k] : ((sol[k] % pub.size) + 1);
        const full = grid.every((v: number) => v > 0);
        const res = await submit(id, { grid, final: full });
        if (res.status === "wrong") {
          for (let q = 0; q < grid.length; q++) grid[q] = sol[q];
          await think(4000);
          await submit(id, { grid, final: true });
        }
      }
    } else if (r.config.game === "wordhunt") {
      const history: { word: string; tiles: string[] }[] = [];
      for (let g = 0; g < pub.maxGuesses; g++) {
        if (!live(id)) return;
        await think(7000);
        const cands = wordleCandidates(history);
        const guess = g === 0 ? rng.pick(["crane", "slate", "pilot", "about", "house"]) : good() ? rng.pick(cands) : rng.pick(WORDHUNT_ANSWERS);
        const res = await submit(id, { guess });
        if (res.status === "solved" || res.status === "failed") return;
        const tiles = (res.feedback as any)?.tiles;
        if (tiles) history.push({ word: guess, tiles });
      }
    } else if (r.config.game === "numbercrunch") {
      await think(12000);
      if (!live(id)) return;
      const best = solveCrunch(pub.numbers, pub.target, good() ? 1500 : 30);
      await submit(id, { expr: best.expr });
    }
  }

  await connect();
  // churn: occasionally drop the connection and come back (refresh / Wi-Fi blip)
  for (;;) {
    await sleep(10_000);
    if (rng.next() < CHURN) {
      socket!.disconnect();
      await sleep(1500 + rng.int(4000));
      await connect();
    }
  }
}

async function main() {
  console.log(`Spawning ${N} bots against ${URL} (skill ${SKILL}, churn ${CHURN})…`);
  const stats: BotStats[] = Array.from({ length: N }, () => ({ joined: false, submits: 0, lbLatency: [] }));
  for (let i = 0; i < N; i++) {
    void bot(i + 1, stats[i]).catch((e) => console.error(`bot ${i + 1} crashed`, e));
    await sleep(60);
  }
  setInterval(() => {
    const joined = stats.filter((s) => s.joined).length;
    const submits = stats.reduce((a, s) => a + s.submits, 0);
    const lat = stats.flatMap((s) => s.lbLatency.splice(0)).sort((a, b) => a - b);
    const p = (q: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * q))] : 0);
    console.log(`joined ${joined}/${N} · submits ${submits} · leaderboard update after submit p50 ${p(0.5)}ms p95 ${p(0.95)}ms`);
  }, 5000);
}

void main();
