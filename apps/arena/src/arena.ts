import {
  COUNTDOWN_MS,
  DEFAULT_CONFIG,
  SCORING,
  getGame,
  partialPoints,
  randomSeed,
  solvePoints,
  type CheatAction,
  type CheatFlag,
  type CheatPayload,
  type DeptEntry,
  type EventConfig,
  type FeedItem,
  type FeedKind,
  type HostPlayer,
  type HostState,
  type JoinAck,
  type JoinPayload,
  type LbEntry,
  type LbMessage,
  type MeState,
  type NetworkInfo,
  type Phase,
  type PublicRound,
  type PublicState,
  type Reveal,
  type RoundConfig,
  type RoundResult,
  type RoundStatus,
  type SubmitAck,
} from "@iedc/shared";
import { errors } from "@iedc/data/copy/errors";
import { feed } from "@iedc/data/copy/feed";
import { anticheat } from "@iedc/data/copy/anticheat";
import { LIVE_LEADERBOARD_SIZE } from "@iedc/data/rules";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Player {
  id: string;
  token: string;
  name: string;
  sem: string;
  dept: string;
  avatar: number;
  score: number;
  solves: number;
  streak: number;
  totalSolveMs: number;
  strikes: number;
  internet: boolean;
  eliminated: boolean;
  kicked: boolean;
  online: boolean;
  socketId: string | null;
  ip: string;
  rtt: number | null;
  joinedAt: number;
  rankAtRoundStart: number;
  roundPoints: Record<string, number>;
}

interface PlayerRound {
  status: RoundStatus;
  progress: unknown;
  wrong: number;
  points: number;
  solvedMs: number | null;
  lastSubmitAt: number;
  internetStruck: boolean;
}

interface RoundRuntime {
  id: string;
  index: number;
  config: RoundConfig;
  seed: number;
  pub: unknown;
  secret: unknown;
  startsAt: number;
  endsAt: number;
  pausedRemainingMs: number | null;
  players: Record<string, PlayerRound>;
  firstSolver: string | null;
  reveal: Reveal | null;
  results: RoundResult[] | null;
}

export interface ArenaOutput {
  state(s: PublicState): void;
  me(playerId: string, me: MeState): void;
  lb(msg: LbMessage): void;
  feed(item: FeedItem): void;
  host(h: HostState): void;
  kicked(playerId: string, reason: string): void;
  log(type: string, data: Record<string, unknown>): void;
}

export interface ArenaOptions {
  out: ArenaOutput;
  now?: () => number;
  network?: () => NetworkInfo;
}

export interface ArenaSnapshot {
  v: 1;
  config: EventConfig;
  phase: Phase;
  roundIndex: number;
  roundsPlayed: number;
  players: Player[];
  round: RoundRuntime | null;
  history: { id: string; title: string }[];
  flags: CheatFlag[];
}

const LB_TOP_LIVE = LIVE_LEADERBOARD_SIZE;
const SUBMIT_MIN_GAP_MS = 120;
const END_GRACE_MS = 600;

const shortId = () => Math.random().toString(36).slice(2, 10);

/* ------------------------------------------------------------------ */
/* Arena: the whole tournament, no sockets in here                     */
/* ------------------------------------------------------------------ */

export class Arena {
  config: EventConfig = structuredClone(DEFAULT_CONFIG);
  phase: Phase = "lobby";
  roundIndex = -1;
  roundsPlayed = 0;
  players = new Map<string, Player>();
  round: RoundRuntime | null = null;
  history: { id: string; title: string }[] = [];
  flags: CheatFlag[] = [];
  feedLog: FeedItem[] = [];
  /** bumps on every change; the persister saves when it moves */
  version = 0;

  private out: ArenaOutput;
  private now: () => number;
  private network: () => NetworkInfo;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private feedSeq = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private lbTimer: ReturnType<typeof setTimeout> | null = null;
  private lastLbAt = 0;
  private dirtyMe = new Set<string>();
  private dirtyAllMe = false;

  constructor(opts: ArenaOptions) {
    this.out = opts.out;
    this.now = opts.now ?? Date.now;
    this.network = opts.network ?? (() => ({ port: 0, interfaces: [], internet: null, groups: [] }));
  }

  /* ---------------- players ---------------- */

  /** Reconnect by device token. Returns null when the token is new. */
  attach(token: string, socketId: string, ip: string): { player: Player | null; previousSocket: string | null } {
    const p = this.byToken(token);
    if (!p) return { player: null, previousSocket: null };
    if (p.kicked) return { player: p, previousSocket: null };
    const previousSocket = p.online && p.socketId && p.socketId !== socketId ? p.socketId : null;
    p.online = true;
    p.socketId = socketId;
    p.ip = ip;
    this.touch({ me: [p.id], host: true, state: true });
    return { player: p, previousSocket };
  }

  join(payload: JoinPayload, socketId: string, ip: string): JoinAck & { previousSocket?: string | null } {
    const existing = this.byToken(payload.token);
    if (existing?.kicked) return { ok: false, error: errors.removedByHost };
    const name = payload.name.replace(/\s+/g, " ").trim();
    const clash = [...this.players.values()].find(
      (p) => !p.kicked && p.token !== payload.token && p.name.toLowerCase() === name.toLowerCase() && p.dept === payload.dept,
    );
    if (clash) return { ok: false, error: errors.duplicateName };

    let previousSocket: string | null = null;
    let p = existing;
    if (p) {
      previousSocket = p.online && p.socketId !== socketId ? p.socketId : null;
      Object.assign(p, { name, sem: payload.sem, dept: payload.dept, avatar: payload.avatar });
    } else {
      p = {
        id: shortId(),
        token: payload.token,
        name,
        sem: payload.sem,
        dept: payload.dept,
        avatar: payload.avatar,
        score: 0,
        solves: 0,
        streak: 0,
        totalSolveMs: 0,
        strikes: 0,
        internet: false,
        // in knockout, latecomers after round 1 only spectate
        eliminated: this.config.format === "knockout" && this.roundsPlayed > 0,
        kicked: false,
        online: true,
        socketId,
        ip,
        rtt: null,
        joinedAt: this.now(),
        rankAtRoundStart: this.players.size + 1,
        roundPoints: {},
      };
      this.players.set(p.id, p);
      this.pushFeed("join", feed.joined(firstName(p.name), p.dept));
      this.out.log("join", { id: p.id, name: p.name, sem: p.sem, dept: p.dept, ip });
    }
    p.online = true;
    p.socketId = socketId;
    p.ip = ip;
    this.touch({ me: [p.id], host: true, state: true, lb: true });
    return { ok: true, me: this.meState(p), previousSocket };
  }

  disconnect(socketId: string) {
    for (const p of this.players.values()) {
      if (p.socketId === socketId) {
        p.online = false;
        p.socketId = null;
        this.touch({ host: true, state: true });
      }
    }
  }

  setRtt(playerId: string, rtt: number) {
    const p = this.players.get(playerId);
    if (p) p.rtt = Math.round(rtt);
  }

  /* ---------------- host config ---------------- */

  setConfig(cfg: EventConfig) {
    const wasKnockout = this.config.format === "knockout";
    this.config = structuredClone(cfg);
    if (wasKnockout && cfg.format !== "knockout") for (const p of this.players.values()) p.eliminated = false;
    this.touch({ state: true, host: true });
  }

  /* ---------------- round lifecycle ---------------- */

  startRound(index?: number): { ok: boolean; error?: string } {
    if (this.phase === "countdown" || this.phase === "playing") return { ok: false, error: errors.roundAlreadyRunning };
    const i = index ?? this.roundIndex + 1;
    const cfg = this.config.rounds[i];
    if (!cfg) return { ok: false, error: errors.playlistFinished };
    if (this.activePlayers().length === 0) return { ok: false, error: errors.nobodyJoined };

    const game = getGame(cfg.game);
    const seed = randomSeed();
    const { pub, secret } = game.generate(seed, cfg.difficulty, cfg.options);
    const startsAt = this.now() + COUNTDOWN_MS;
    this.roundIndex = i;
    this.round = {
      id: `${cfg.id}-${shortId()}`,
      index: i,
      config: cfg,
      seed,
      pub,
      secret,
      startsAt,
      endsAt: startsAt + cfg.timeLimitSec * 1000,
      pausedRemainingMs: null,
      players: {},
      firstSolver: null,
      reveal: null,
      results: null,
    };
    const ranks = this.ranking();
    ranks.forEach((p, idx) => (p.rankAtRoundStart = idx + 1));
    for (const p of this.activePlayers()) this.round.players[p.id] = this.freshPlayerRound(game.initialProgress(pub));
    this.phase = "countdown";
    this.clearTimers();
    this.timers.push(setTimeout(() => this.beginPlaying(), COUNTDOWN_MS));
    this.out.log("round:start", { id: this.round.id, game: cfg.game, difficulty: cfg.difficulty, seed });
    this.pushFeed("info", feed.roundStarting(i + 1, game.title));
    this.touch({ state: true, host: true, allMe: true, lb: true });
    return { ok: true };
  }

  private beginPlaying() {
    if (!this.round || this.phase !== "countdown") return;
    this.phase = "playing";
    this.scheduleEnd(this.round.endsAt - this.now());
    this.touch({ state: true, host: true, allMe: true });
  }

  private scheduleEnd(ms: number) {
    this.clearTimers();
    this.timers.push(setTimeout(() => this.endRound(), Math.max(0, ms) + END_GRACE_MS));
  }

  pause(): { ok: boolean; error?: string } {
    const r = this.round;
    if (!r || this.phase !== "playing" || r.pausedRemainingMs !== null) return { ok: false, error: errors.nothingToPause };
    r.pausedRemainingMs = Math.max(0, r.endsAt - this.now());
    this.clearTimers();
    this.pushFeed("info", feed.paused);
    this.touch({ state: true, host: true });
    return { ok: true };
  }

  resume(): { ok: boolean; error?: string } {
    const r = this.round;
    if (!r || r.pausedRemainingMs === null) return { ok: false, error: errors.notPaused };
    r.endsAt = this.now() + r.pausedRemainingMs;
    r.pausedRemainingMs = null;
    this.scheduleEnd(r.endsAt - this.now());
    this.touch({ state: true, host: true });
    return { ok: true };
  }

  endRound(): { ok: boolean; error?: string } {
    const r = this.round;
    if (!r || (this.phase !== "playing" && this.phase !== "countdown")) return { ok: false, error: errors.noRunningRound };
    this.clearTimers();
    const game = getGame(r.config.game);
    for (const p of this.activePlayers()) {
      const pr = (r.players[p.id] ??= this.freshPlayerRound(game.initialProgress(r.pub)));
      if (pr.status === "playing" || pr.status === "idle") {
        pr.status = "timeout";
        pr.points = partialPoints(game.partialCredit(r.pub, r.secret, pr.progress), pr.wrong);
        p.score += pr.points;
      }
      if (pr.status !== "solved") p.streak = 0;
      p.roundPoints[r.id] = pr.points;
    }
    r.reveal = game.reveal(r.pub, r.secret);
    r.results = Object.entries(r.players)
      .map(([id, pr]) => {
        const p = this.players.get(id)!;
        return { id, name: p.name, dept: p.dept, avatar: p.avatar, status: pr.status, points: pr.points, solvedMs: pr.solvedMs };
      })
      .sort((a, b) => b.points - a.points || (a.solvedMs ?? Infinity) - (b.solvedMs ?? Infinity));
    this.history.push({ id: r.id, title: `R${r.index + 1} ${game.title}` });
    this.roundsPlayed++;
    this.phase = "results";
    if (this.config.format === "knockout") this.knockOut();
    this.out.log("round:end", {
      id: r.id,
      results: r.results.map((x) => ({ id: x.id, points: x.points, status: x.status })),
    });
    this.touch({ state: true, host: true, allMe: true, lb: true });
    return { ok: true };
  }

  private knockOut() {
    const alive = this.ranking().filter((p) => !p.eliminated);
    if (alive.length <= 2) return;
    const cut = Math.min(alive.length - 2, Math.floor((alive.length * this.config.knockoutPct) / 100));
    if (cut <= 0) return;
    const out = alive.slice(-cut);
    for (const p of out) p.eliminated = true;
    this.pushFeed("out", feed.knockedOut(cut, alive.length - cut));
  }

  showPodium() {
    if (this.phase === "countdown" || this.phase === "playing") this.endRound();
    this.phase = "podium";
    this.pushFeed("info", feed.podium);
    this.touch({ state: true, host: true, allMe: true, lb: true });
    return { ok: true };
  }

  toLobby() {
    if (this.phase === "countdown" || this.phase === "playing") return { ok: false, error: errors.endRoundFirst };
    this.phase = "lobby";
    this.touch({ state: true, host: true, allMe: true, lb: true });
    return { ok: true };
  }

  reset(keepPlayers: boolean) {
    this.clearTimers();
    this.phase = "lobby";
    this.round = null;
    this.roundIndex = -1;
    this.roundsPlayed = 0;
    this.history = [];
    this.flags = [];
    this.feedLog = [];
    if (keepPlayers) {
      for (const p of this.players.values()) {
        Object.assign(p, { score: 0, solves: 0, streak: 0, totalSolveMs: 0, strikes: 0, eliminated: false, roundPoints: {} });
      }
    } else {
      for (const p of this.players.values()) if (p.online) this.out.kicked(p.id, errors.freshEvent);
      this.players.clear();
    }
    this.out.log("reset", { keepPlayers });
    this.touch({ state: true, host: true, allMe: true, lb: true });
    return { ok: true };
  }

  /* ---------------- gameplay ---------------- */

  submit(playerId: string, roundId: string, rawSub: unknown): SubmitAck {
    const p = this.players.get(playerId);
    const r = this.round;
    if (!p || p.kicked) return { ok: false, error: errors.notInEvent };
    if (!r || r.id !== roundId) return { ok: false, error: errors.roundOver };
    if (this.phase !== "playing") return { ok: false, error: errors.roundNotLive };
    if (r.pausedRemainingMs !== null) return { ok: false, error: errors.paused };
    const now = this.now();
    if (now > r.endsAt + END_GRACE_MS) return { ok: false, error: errors.timesUp };
    if (p.eliminated) return { ok: false, error: errors.spectating };
    if (p.internet && this.config.blockInternet) return { ok: false, error: errors.internetOn };

    const game = getGame(r.config.game);
    const pr = (r.players[p.id] ??= this.freshPlayerRound(game.initialProgress(r.pub)));
    if (pr.status === "locked") return { ok: false, error: errors.lockedOut };
    if (pr.status !== "playing" && pr.status !== "idle") return { ok: false, error: errors.alreadyDone };
    if (now - pr.lastSubmitAt < SUBMIT_MIN_GAP_MS) return { ok: false, error: errors.tooFast };
    pr.lastSubmitAt = now;

    const parsed = game.subSchema.safeParse(rawSub);
    if (!parsed.success) return { ok: false, error: errors.badMove };
    const res = game.check(r.pub, r.secret, pr.progress, parsed.data);
    pr.progress = res.progress;
    pr.status = "playing";
    if (res.penalty) pr.wrong++;

    if (res.status === "solved") {
      const elapsed = Math.max(0, now - r.startsAt);
      const first = !r.firstSolver;
      pr.status = "solved";
      pr.solvedMs = elapsed;
      pr.points = solvePoints({
        difficulty: r.config.difficulty,
        elapsedMs: elapsed,
        limitMs: r.config.timeLimitSec * 1000,
        wrong: pr.wrong,
        first,
        quality: res.quality,
      });
      p.score += pr.points;
      p.solves++;
      p.streak++;
      p.totalSolveMs += elapsed;
      if (first) {
        r.firstSolver = p.id;
        this.pushFeed("firstblood", feed.firstBlood(firstName(p.name), p.dept, fmtSecs(elapsed)));
      } else {
        this.pushFeed("solve", feed.solved(firstName(p.name), fmtSecs(elapsed)));
      }
      if ((feed.streakAt as readonly number[]).includes(p.streak)) this.pushFeed("streak", feed.streak(firstName(p.name), p.streak));
    } else if (res.status === "failed") {
      pr.status = "failed";
      pr.points = partialPoints(game.partialCredit(r.pub, r.secret, pr.progress), pr.wrong);
      p.score += pr.points;
    }
    this.out.log("submit", { r: r.id, p: p.id, s: res.status, pts: pr.points });
    this.touch({ me: [p.id], lb: true, state: res.status === "solved" || res.status === "failed", host: true });
    this.maybeEndEarly();
    return { ok: true, status: res.status, feedback: res.feedback, message: res.message, progress: pr.progress, points: pr.points };
  }

  private maybeEndEarly() {
    const r = this.round;
    if (!r || this.phase !== "playing") return;
    const stillPlaying = this.activePlayers().some((p) => {
      const pr = r.players[p.id];
      return !pr || pr.status === "playing" || pr.status === "idle";
    });
    if (!stillPlaying) {
      this.clearTimers();
      this.timers.push(setTimeout(() => this.endRound(), 1500));
    }
  }

  /* ---------------- anti-cheat ---------------- */

  cheat(playerId: string, c: CheatPayload): { action: CheatAction } {
    const p = this.players.get(playerId);
    if (!p) return { action: "noted" };
    const r = this.round;
    const pr = r && this.phase === "playing" ? r.players[p.id] : undefined;
    const inPlay = !!pr && (pr.status === "playing" || pr.status === "idle") && !p.eliminated;

    if (c.kind === "internet") {
      if (!this.config.blockInternet) return { action: "noted" };
      const first = !p.internet;
      p.internet = true;
      if (!inPlay || pr!.internetStruck) {
        if (first) this.addFlag(p, c, "noted");
        this.touch({ me: [p.id], host: true });
        return { action: "noted" };
      }
      pr!.internetStruck = true;
    } else if (!inPlay) {
      return { action: "noted" };
    }

    p.strikes++;
    let action: CheatAction = "warn";
    if (p.strikes >= this.config.strikeLockAt) {
      action = "lock";
      pr!.status = "locked";
      pr!.points = 0;
      this.maybeEndEarly();
    } else if (p.strikes >= this.config.strikePenaltyAt) {
      action = "penalty";
      p.score -= SCORING.strikePenalty;
    }
    this.addFlag(p, c, action);
    this.touch({ me: [p.id], host: true, lb: action !== "warn" });
    return { action };
  }

  clearInternet(playerId: string) {
    const p = this.players.get(playerId);
    if (!p || !p.internet) return;
    p.internet = false;
    this.touch({ me: [p.id], host: true });
  }

  private addFlag(p: Player, c: CheatPayload, action: CheatAction) {
    const detail =
      c.kind === "internet"
        ? c.detail ?? anticheat.flagInternet
        : anticheat.flagLeft(fmtSecs(c.ms ?? 0), c.detail);
    this.flags.unshift({ at: this.now(), playerId: p.id, name: p.name, kind: c.kind, detail, action });
    if (this.flags.length > 300) this.flags.length = 300;
    this.out.log("cheat", { p: p.id, kind: c.kind, detail, action, strikes: p.strikes });
  }

  /* ---------------- host moderation ---------------- */

  kick(id: string) {
    const p = this.players.get(id);
    if (!p) return { ok: false, error: errors.noSuchPlayer };
    p.kicked = true;
    p.online = false;
    this.out.kicked(p.id, errors.removedByHost);
    p.socketId = null;
    this.touch({ host: true, state: true, lb: true });
    return { ok: true };
  }

  /** Clears strikes, the internet flag, a round lock and a kick. */
  unblock(id: string) {
    const p = this.players.get(id);
    if (!p) return { ok: false, error: errors.noSuchPlayer };
    p.strikes = 0;
    p.internet = false;
    p.kicked = false;
    const pr = this.round?.players[id];
    if (pr && pr.status === "locked" && this.phase === "playing") pr.status = "playing";
    this.touch({ me: [id], host: true, lb: true });
    return { ok: true };
  }

  adjust(id: string, delta: number) {
    const p = this.players.get(id);
    if (!p) return { ok: false, error: errors.noSuchPlayer };
    p.score += delta;
    this.pushFeed("info", feed.hostAdjusted(firstName(p.name), delta));
    this.touch({ me: [id], host: true, lb: true });
    return { ok: true };
  }

  /* ---------------- views ---------------- */

  activePlayers(): Player[] {
    return [...this.players.values()].filter((p) => !p.kicked && !p.eliminated);
  }

  ranking(): Player[] {
    return [...this.players.values()]
      .filter((p) => !p.kicked)
      .sort((a, b) => b.score - a.score || a.totalSolveMs - b.totalSolveMs || a.joinedAt - b.joinedAt);
  }

  private roundStatusOf(p: Player): RoundStatus {
    if (p.eliminated) return "out";
    const pr = this.round?.players[p.id];
    if (!pr || this.phase === "lobby" || this.phase === "podium") return "idle";
    return pr.status;
  }

  private lbEntry(p: Player, rank: number): LbEntry {
    return {
      id: p.id,
      name: p.name,
      dept: p.dept,
      sem: p.sem,
      avatar: p.avatar,
      score: p.score,
      rank,
      delta: p.rankAtRoundStart - rank,
      solves: p.solves,
      streak: p.streak,
      roundStatus: this.roundStatusOf(p),
      eliminated: p.eliminated,
    };
  }

  lbMessage(): LbMessage {
    const ranked = this.ranking();
    const live = this.phase === "playing" || this.phase === "countdown";
    const entries = (live ? ranked.slice(0, LB_TOP_LIVE) : ranked).map((p, i) => this.lbEntry(p, i + 1));
    return { entries, full: !live, total: ranked.length, depts: this.depts(ranked) };
  }

  private depts(ranked: Player[]): DeptEntry[] {
    const map = new Map<string, { players: number; total: number }>();
    for (const p of ranked) {
      const d = map.get(p.dept) ?? { players: 0, total: 0 };
      d.players++;
      d.total += p.score;
      map.set(p.dept, d);
    }
    return [...map.entries()]
      .map(([dept, d]) => ({ dept, players: d.players, total: d.total, avg: Math.round(d.total / d.players) }))
      .sort((a, b) => b.avg - a.avg || b.players - a.players);
  }

  meState(p: Player): MeState {
    const ranked = this.ranking();
    const rank = ranked.indexOf(p) + 1;
    const r = this.round;
    const pr = r ? r.players[p.id] : undefined;
    return {
      id: p.id,
      name: p.name,
      sem: p.sem,
      dept: p.dept,
      avatar: p.avatar,
      score: p.score,
      rank,
      of: ranked.length,
      delta: p.rankAtRoundStart - rank,
      strikes: p.strikes,
      internetBlocked: p.internet && this.config.blockInternet,
      eliminated: p.eliminated,
      streak: p.streak,
      round:
        r && pr && this.phase !== "lobby" && this.phase !== "podium"
          ? { roundId: r.id, status: pr.status, progress: pr.progress, points: pr.points, wrong: pr.wrong }
          : null,
    };
  }

  publicState(): PublicState {
    const r = this.round;
    const net = this.network();
    let round: PublicRound | null = null;
    if (r && this.phase !== "lobby" && this.phase !== "podium") {
      const active = this.activePlayers();
      round = {
        id: r.id,
        index: r.index,
        total: this.config.rounds.length,
        config: r.config,
        title: getGame(r.config.game).title,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        pausedRemainingMs: r.pausedRemainingMs,
        pub: this.phase === "playing" || this.phase === "results" ? r.pub : null,
        reveal: this.phase === "results" ? r.reveal : null,
        results: this.phase === "results" ? r.results?.slice(0, 20) ?? null : null,
        solvedCount: Object.values(r.players).filter((x) => x.status === "solved").length,
        // during results: everyone who took part (knockouts already removed some from `active`)
        activeCount: this.phase === "results" ? Object.keys(r.players).length : active.length,
        firstSolver: r.firstSolver ? this.players.get(r.firstSolver)?.name ?? null : null,
      };
    }
    const all = [...this.players.values()].filter((p) => !p.kicked);
    return {
      eventName: this.config.eventName,
      phase: this.phase,
      format: this.config.format,
      round,
      roundsPlayed: this.roundsPlayed,
      roundsTotal: this.config.rounds.length,
      playerCount: all.length,
      onlineCount: all.filter((p) => p.online).length,
      joinUrls: net.interfaces.map((i) => ({ label: i.label, url: i.url, qrSvg: i.qrSvg })),
      blockInternet: this.config.blockInternet,
      nextRound: this.phase === "lobby" || this.phase === "results" ? this.config.rounds[this.roundIndex + 1] ?? null : null,
    };
  }

  hostState(): HostState {
    const ranked = this.ranking();
    const kicked = [...this.players.values()].filter((p) => p.kicked);
    const players: HostPlayer[] = [...ranked, ...kicked].map((p, i) => ({
      ...this.lbEntry(p, p.kicked ? 0 : i + 1),
      online: p.online,
      ip: p.ip,
      rtt: p.rtt,
      strikes: p.strikes,
      internet: p.internet,
      kicked: p.kicked,
    }));
    const net = this.network();
    const groups = new Map<string, number>();
    for (const p of this.players.values()) if (p.online) groups.set(p.ip, (groups.get(p.ip) ?? 0) + 1);
    return {
      config: this.config,
      players,
      flags: this.flags.slice(0, 80),
      network: { ...net, groups: [...groups.entries()].map(([ip, count]) => ({ ip, count })).sort((a, b) => b.count - a.count) },
      paused: this.round?.pausedRemainingMs != null,
      roundIndex: this.roundIndex,
    };
  }

  recentFeed(): FeedItem[] {
    return this.feedLog.slice(-8);
  }

  /* ---------------- export ---------------- */

  toCsv(): string {
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ["Rank", "Name", "Semester", "Department", "Score", "Solves", "Strikes", "Eliminated", ...this.history.map((h) => h.title)];
    const rows = this.ranking().map((p, i) => [
      i + 1,
      p.name,
      p.sem,
      p.dept,
      p.score,
      p.solves,
      p.strikes,
      p.eliminated ? "yes" : "",
      ...this.history.map((h) => p.roundPoints[h.id] ?? ""),
    ]);
    return [head, ...rows].map((r) => r.map(esc).join(",")).join("\n") + "\n";
  }

  /* ---------------- persistence ---------------- */

  snapshot(): ArenaSnapshot {
    return {
      v: 1,
      config: this.config,
      phase: this.phase,
      roundIndex: this.roundIndex,
      roundsPlayed: this.roundsPlayed,
      players: [...this.players.values()],
      round: this.round,
      history: this.history,
      flags: this.flags,
    };
  }

  restore(s: ArenaSnapshot) {
    this.config = { ...structuredClone(DEFAULT_CONFIG), ...s.config };
    this.roundIndex = s.roundIndex;
    this.roundsPlayed = s.roundsPlayed;
    this.history = s.history ?? [];
    this.flags = s.flags ?? [];
    this.players = new Map(s.players.map((p) => [p.id, { ...p, online: false, socketId: null }]));
    this.round = s.round;
    this.phase = s.phase;
    // a round that was live when the laptop died is closed out fairly (timeouts get partial credit)
    if (this.phase === "countdown" || this.phase === "playing") {
      if (this.round) this.round.pausedRemainingMs = null;
      this.endRound();
    }
    this.touch({ state: true, host: true, lb: true });
  }

  /* ---------------- outbound batching ---------------- */

  private pushFeed(kind: FeedKind, text: string) {
    const item = { id: ++this.feedSeq, at: this.now(), kind, text };
    this.feedLog.push(item);
    if (this.feedLog.length > 50) this.feedLog.shift();
    this.out.feed(item);
  }

  private pending = { state: false, host: false, lb: false };

  private touch(what: { state?: boolean; host?: boolean; lb?: boolean; me?: string[]; allMe?: boolean }) {
    this.version++;
    if (what.state) this.pending.state = true;
    if (what.host) this.pending.host = true;
    if (what.allMe) this.dirtyAllMe = true;
    for (const id of what.me ?? []) this.dirtyMe.add(id);
    if (what.lb) this.scheduleLb();
    if (!this.flushTimer) this.flushTimer = setTimeout(() => this.flush(), 60);
  }

  private scheduleLb() {
    this.pending.lb = true;
    if (this.lbTimer) return;
    const live = this.phase === "playing";
    const wait = live ? Math.max(0, 500 - (this.now() - this.lastLbAt)) : 80;
    this.lbTimer = setTimeout(() => {
      this.lbTimer = null;
      this.lastLbAt = this.now();
      this.pending.lb = false;
      this.out.lb(this.lbMessage());
      // everyone's rank may have moved
      this.dirtyAllMe = true;
      this.flush();
    }, wait);
  }

  /** Push everything that changed. Public for tests. */
  flush() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (this.pending.state) this.out.state(this.publicState());
    if (this.pending.host) this.out.host(this.hostState());
    this.pending.state = this.pending.host = false;
    const ids = this.dirtyAllMe ? [...this.players.keys()] : [...this.dirtyMe];
    this.dirtyAllMe = false;
    this.dirtyMe.clear();
    for (const id of ids) {
      const p = this.players.get(id);
      if (p && p.online && !p.kicked) this.out.me(id, this.meState(p));
    }
  }

  private byToken(token: string): Player | undefined {
    for (const p of this.players.values()) if (p.token === token) return p;
    return undefined;
  }

  private freshPlayerRound(progress: unknown): PlayerRound {
    return { status: "playing", progress, wrong: 0, points: 0, solvedMs: null, lastSubmitAt: 0, internetStruck: false };
  }

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  dispose() {
    this.clearTimers();
    if (this.flushTimer) clearTimeout(this.flushTimer);
    if (this.lbTimer) clearTimeout(this.lbTimer);
  }
}

function firstName(name: string) {
  return name.split(" ")[0];
}

function fmtSecs(ms: number) {
  const s = Math.round(ms / 100) / 10;
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
