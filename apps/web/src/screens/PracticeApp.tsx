"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { GAME_META, GAME_ORDER } from "@iedc/shared/games/meta";
import type { Difficulty, GameDefinition, GameId, Reveal as RevealT } from "@iedc/shared/games/types";
import type { SubmitAck } from "@iedc/shared/protocol";
import { VIEWS } from "@/games";
import { store } from "@/lib/storage";
import { cx, fmtSecs } from "@/lib/format";
import { useNoCopy } from "@/anticheat/useAntiCheat";
import { Confetti } from "@/ui/Confetti";
import { Btn, COLOR, Hand, Slip } from "@/ui/kit";
import { Mascot } from "@/ui/Mascot";
import { Reveal } from "@/ui/Reveal";
import { sfx } from "@/ui/sfx";
import { TimerBar } from "@/ui/Timer";

interface Session {
  game: GameId;
  difficulty: Difficulty;
  def: GameDefinition;
  pub: unknown;
  secret: unknown;
  progress: unknown;
  startedAt: number;
  limitMs: number;
  wrong: number;
  result: { points: number; status: string; ms: number; reveal: RevealT } | null;
}

const DIFF: Difficulty[] = ["easy", "med", "hard"];
const bestKey = (g: GameId, d: Difficulty) => `ba:best:${g}:${d}`;

/** Solo warm-up using the same engines as the arena, entirely in the browser. Works offline once installed. */
export function PracticeApp() {
  const [game, setGame] = useState<GameId | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("game") as GameId | null;
    if (g && GAME_META[g]) setGame(g);
  }, []);

  const start = async () => {
    if (!game) return;
    setLoading(true);
    const [{ GAMES }, { randomSeed }] = await Promise.all([import("@iedc/shared/games/registry"), import("@iedc/shared/rng")]);
    const def = GAMES[game];
    const { pub, secret } = def.generate(randomSeed(), difficulty);
    setSession({
      game,
      difficulty,
      def,
      pub,
      secret,
      progress: def.initialProgress(pub),
      startedAt: Date.now(),
      limitMs: def.defaultTimeSec[difficulty] * 1000,
      wrong: 0,
      result: null,
    });
    setLoading(false);
  };

  if (session) return <PracticeRound session={session} setSession={setSession} onExit={() => setSession(null)} onAgain={start} />;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pb-12 pt-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="chip">
          ← home
        </Link>
        <h1 className="text-3xl font-black">
          <span className="hl">Practice room</span>
        </h1>
      </header>
      <Hand className="-mt-3 text-lg">No pressure, no leaderboard. Just you vs. the clock (and your personal best).</Hand>
      <div className="grid gap-4 sm:grid-cols-2">
        {GAME_ORDER.map((g, i) => {
          const m = GAME_META[g];
          return (
            <button
              key={g}
              type="button"
              onClick={() => setGame(g)}
              className={cx("slip text-left transition-transform", game === g ? "-translate-y-1 !shadow-[6px_6px_0_0_var(--color-ink)]" : "")}
              style={{ background: game === g ? COLOR[m.color] : "var(--color-card)", transform: `rotate(${[-1.2, 0.8, 1.1, -0.7][i]}deg)` }}
            >
              <div className="px-4 py-3">
                <div className="text-xl font-black">{m.title}</div>
                <Hand className="!text-ink-soft text-base">{m.tagline}</Hand>
              </div>
            </button>
          );
        })}
      </div>
      {game && (
        <Slip taped className="flex flex-col gap-3 px-4 pb-4 pt-6">
          <p className="font-medium">{GAME_META[game].howTo}</p>
          <div className="flex gap-2">
            {DIFF.map((d) => (
              <button key={d} type="button" className={cx("chip !px-3 !py-1.5", difficulty === d && "!bg-ink !text-paper")} onClick={() => setDifficulty(d)}>
                {d === "med" ? "medium" : d}
              </button>
            ))}
            <span className="ml-auto self-center text-sm font-bold text-pencil">
              best: {store.get<number | null>(bestKey(game, difficulty), null) ?? "–"}
            </span>
          </div>
          <Btn size="lg" tone="mint" onClick={start} disabled={loading}>
            {loading ? "Shuffling…" : "Start warm-up"}
          </Btn>
        </Slip>
      )}
    </main>
  );
}

function PracticeRound({
  session,
  setSession,
  onExit,
  onAgain,
}: {
  session: Session;
  setSession: (s: Session | null) => void;
  onExit: () => void;
  onAgain: () => void;
}) {
  const ref = useRef(session);
  ref.current = session;
  const [now, setNow] = useState(Date.now());
  const meta = GAME_META[session.game];
  const View = VIEWS[session.game];
  useNoCopy(!session.result);

  const finish = useCallback(
    async (status: "solved" | "failed" | "timeout", quality?: number) => {
      const s = ref.current;
      if (s.result) return;
      const { solvePoints, partialPoints } = await import("@iedc/shared/scoring");
      const ms = Date.now() - s.startedAt;
      const points =
        status === "solved"
          ? solvePoints({ difficulty: s.difficulty, elapsedMs: ms, limitMs: s.limitMs, wrong: s.wrong, first: false, quality })
          : partialPoints(s.def.partialCredit(s.pub, s.secret, s.progress), s.wrong);
      const best = store.get<number>(bestKey(s.game, s.difficulty), 0);
      if (points > best) store.set(bestKey(s.game, s.difficulty), points);
      setSession({ ...s, result: { points, status, ms, reveal: s.def.reveal(s.pub, s.secret) } });
      if (status === "solved") sfx.win();
    },
    [setSession],
  );

  useEffect(() => {
    if (session.result) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() - ref.current.startedAt > ref.current.limitMs) void finish("timeout");
    }, 250);
    return () => clearInterval(t);
  }, [session.result, finish]);

  const submit = useCallback(
    async (sub: unknown): Promise<SubmitAck> => {
      const s = ref.current;
      if (s.result) return { ok: false, error: "Round over." };
      const parsed = s.def.subSchema.safeParse(sub);
      if (!parsed.success) return { ok: false, error: "Bad move." };
      const res = s.def.check(s.pub, s.secret, s.progress, parsed.data);
      const next = { ...s, progress: res.progress, wrong: s.wrong + (res.penalty ? 1 : 0) };
      ref.current = next;
      setSession(next);
      if (res.status === "solved") void finish("solved", res.quality);
      else if (res.status === "failed") void finish("failed");
      else if (res.status === "wrong") sfx.buzz();
      return { ok: true, status: res.status, feedback: res.feedback, message: res.message, progress: res.progress };
    },
    [finish, setSession],
  );

  const r = session.result;
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-3 px-4 pb-12 pt-4">
      <div className="flex items-center gap-2">
        <button type="button" className="chip" onClick={onExit}>
          ← games
        </button>
        <h1 className="mr-auto text-xl font-black">
          <span className="hl" style={{ ["--hl" as string]: COLOR[meta.color] }}>
            {meta.title}
          </span>
        </h1>
        <span className="chip">{session.difficulty === "med" ? "medium" : session.difficulty}</span>
      </div>
      {!r && <TimerBar endsAt={session.startedAt + session.limitMs} total={session.limitMs} now={now} />}
      {r ? (
        <Slip taped className="mt-3 flex flex-col items-center gap-3 px-4 pb-5 pt-7 text-center" tilt={-0.8}>
          {r.status === "solved" && <Confetti />}
          <Mascot mood={r.status === "solved" ? "happy" : "dizzy"} size={84} />
          <div className={r.status === "solved" ? "stamp text-4xl" : "text-3xl font-black"}>{r.status === "solved" ? "Solved" : "Time!"}</div>
          <div className="text-2xl font-black">
            {r.points} pts <span className="text-base font-bold text-pencil">in {fmtSecs(r.ms)}</span>
          </div>
          <Hand className="text-lg">the answer</Hand>
          <Reveal reveal={r.reveal} />
          <div className="mt-2 flex gap-2">
            <Btn tone="paper" onClick={onExit}>
              Other games
            </Btn>
            <Btn tone="mint" onClick={onAgain}>
              Again!
            </Btn>
          </div>
        </Slip>
      ) : (
        <div className="pt-2">
          <View pub={session.pub} progress={session.progress} done={false} frozen={false} submit={submit} />
        </div>
      )}
    </main>
  );
}
