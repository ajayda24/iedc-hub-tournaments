import { z } from "zod";
import type { Difficulty, GameId, Reveal, RoundOptions } from "./games/types";

/* ------------------------------------------------------------------ */
/* Event names                                                         */
/* ------------------------------------------------------------------ */

export const EV = {
  // client → server
  hello: "hello",
  join: "join",
  ping: "ping",
  rtt: "rtt",
  submit: "submit",
  cheat: "cheat",
  cheatClear: "cheat:clear",
  hostConfig: "host:config",
  hostStart: "host:start",
  hostEnd: "host:end",
  hostPause: "host:pause",
  hostResume: "host:resume",
  hostPodium: "host:podium",
  hostLobby: "host:lobby",
  hostKick: "host:kick",
  hostUnblock: "host:unblock",
  hostAdjust: "host:adjust",
  hostReset: "host:reset",
  hostExport: "host:export",
  // server → client
  state: "state",
  me: "me",
  lb: "lb",
  feed: "feed",
  host: "host",
  kicked: "kicked",
  bumped: "bumped",
} as const;

/* ------------------------------------------------------------------ */
/* Shared shapes                                                       */
/* ------------------------------------------------------------------ */

export type Phase = "lobby" | "countdown" | "playing" | "results" | "podium";
export type EventFormat = "classic" | "knockout";
export type Role = "player" | "host" | "screen";
export type RoundStatus = "idle" | "playing" | "solved" | "failed" | "locked" | "timeout" | "out";

export const DEPARTMENTS = ["CSE", "ECE", "EEE", "ME", "CE", "IT", "AI & DS", "Mechatronics", "MCA", "MBA", "Other"];
export const SEMESTERS = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"];

export interface RoundConfig {
  id: string;
  game: GameId;
  difficulty: Difficulty;
  timeLimitSec: number;
  options?: RoundOptions;
}

export interface EventConfig {
  eventName: string;
  format: EventFormat;
  /** knockout: % of the field eliminated after each round */
  knockoutPct: number;
  rounds: RoundConfig[];
  /** strikes at which the penalty / round lock kick in */
  strikePenaltyAt: number;
  strikeLockAt: number;
  /** players must pass the internet probe to play */
  blockInternet: boolean;
}

export interface LbEntry {
  id: string;
  name: string;
  dept: string;
  sem: string;
  avatar: number;
  score: number;
  rank: number;
  /** rank change since the current/last round started (+ = climbed) */
  delta: number;
  solves: number;
  streak: number;
  roundStatus: RoundStatus;
  eliminated: boolean;
}

export interface DeptEntry {
  dept: string;
  players: number;
  avg: number;
  total: number;
}

export interface RoundResult {
  id: string;
  name: string;
  dept: string;
  avatar: number;
  status: RoundStatus;
  points: number;
  solvedMs: number | null;
}

export interface PublicRound {
  id: string;
  index: number;
  total: number;
  config: RoundConfig;
  title: string;
  startsAt: number;
  endsAt: number;
  /** set while the host has paused the round */
  pausedRemainingMs: number | null;
  /** the puzzle (only once the round is playing) */
  pub: unknown | null;
  /** the answer (results phase only) */
  reveal: Reveal | null;
  results: RoundResult[] | null;
  solvedCount: number;
  activeCount: number;
  firstSolver: string | null;
}

export interface PublicState {
  eventName: string;
  phase: Phase;
  format: EventFormat;
  round: PublicRound | null;
  roundsPlayed: number;
  roundsTotal: number;
  playerCount: number;
  onlineCount: number;
  /** urls students can use to join (one per network the arena is on) */
  joinUrls: { label: string; url: string; qrSvg: string }[];
}

export interface MyRound {
  roundId: string;
  status: RoundStatus;
  progress: unknown;
  points: number;
  wrong: number;
}

export interface MeState {
  id: string;
  name: string;
  sem: string;
  dept: string;
  avatar: number;
  score: number;
  rank: number;
  of: number;
  delta: number;
  strikes: number;
  internetBlocked: boolean;
  eliminated: boolean;
  streak: number;
  round: MyRound | null;
}

export interface LbMessage {
  entries: LbEntry[];
  /** true when `entries` is the whole field (between rounds) */
  full: boolean;
  total: number;
  depts: DeptEntry[];
}

export type FeedKind = "firstblood" | "solve" | "streak" | "join" | "info" | "cheat" | "out";
export interface FeedItem {
  id: number;
  at: number;
  kind: FeedKind;
  text: string;
}

export type CheatKind = "internet" | "focus";
export type CheatAction = "warn" | "penalty" | "lock" | "noted";

export interface CheatFlag {
  at: number;
  playerId: string;
  name: string;
  kind: CheatKind;
  detail: string;
  action: CheatAction;
}

export interface HostPlayer extends LbEntry {
  online: boolean;
  ip: string;
  rtt: number | null;
  strikes: number;
  internet: boolean;
  kicked: boolean;
}

export interface NetIface {
  name: string;
  label: string;
  address: string;
  url: string;
  qrSvg: string;
}

export interface NetworkInfo {
  port: number;
  interfaces: NetIface[];
  /** does the arena laptop itself reach the internet? null = not checked yet */
  internet: boolean | null;
  /** players grouped by source IP (players behind a repeater phone share one) */
  groups: { ip: string; count: number }[];
}

export interface HostState {
  config: EventConfig;
  players: HostPlayer[];
  flags: CheatFlag[];
  network: NetworkInfo;
  paused: boolean;
  roundIndex: number;
}

/* ------------------------------------------------------------------ */
/* Inbound payload validation                                          */
/* ------------------------------------------------------------------ */

const trimmed = (max: number) => z.string().trim().min(1).max(max);

export const helloSchema = z.object({
  role: z.enum(["player", "host", "screen"]),
  token: z.string().max(64).optional(),
  pin: z.string().max(12).optional(),
});
export type HelloPayload = z.infer<typeof helloSchema>;

export interface HelloAck {
  ok: boolean;
  error?: string;
  serverNow: number;
  me?: MeState | null;
}

export const joinSchema = z.object({
  token: z.string().min(8).max(64),
  name: trimmed(40),
  sem: trimmed(8),
  dept: trimmed(24),
  avatar: z.number().int().min(0).max(1_000_000),
});
export type JoinPayload = z.infer<typeof joinSchema>;

export interface JoinAck {
  ok: boolean;
  error?: string;
  me?: MeState;
}

export const submitSchema = z.object({
  roundId: z.string().max(40),
  sub: z.unknown(),
});
export type SubmitPayload = z.infer<typeof submitSchema>;

export interface SubmitAck {
  ok: boolean;
  error?: string;
  status?: import("./games/types").CheckStatus;
  feedback?: unknown;
  message?: string;
  progress?: unknown;
  points?: number;
}

export const cheatSchema = z.object({
  kind: z.enum(["internet", "focus"]),
  detail: z.string().max(120).optional(),
  ms: z.number().nonnegative().max(3_600_000).optional(),
});
export type CheatPayload = z.infer<typeof cheatSchema>;

const roundOptionsSchema = z
  .object({
    pack: z.string().max(24).optional(),
    customWords: z.array(z.string().max(16)).max(60).optional(),
  })
  .optional();

export const roundConfigSchema = z.object({
  id: z.string().min(1).max(40),
  game: z.enum(["sudoku", "wordhunt", "anagram", "numbercrunch"]),
  difficulty: z.enum(["easy", "med", "hard"]),
  timeLimitSec: z.number().int().min(20).max(1800),
  options: roundOptionsSchema,
});

export const eventConfigSchema = z.object({
  eventName: trimmed(60),
  format: z.enum(["classic", "knockout"]),
  knockoutPct: z.number().int().min(5).max(75),
  rounds: z.array(roundConfigSchema).max(50),
  strikePenaltyAt: z.number().int().min(1).max(10),
  strikeLockAt: z.number().int().min(1).max(10),
  blockInternet: z.boolean(),
});

export const idSchema = z.object({ id: z.string().max(40) });
export const adjustSchema = z.object({ id: z.string().max(40), delta: z.number().int().min(-100000).max(100000) });
export const startSchema = z.object({ index: z.number().int().min(0).max(49).optional() }).optional();
export const resetSchema = z.object({ keepPlayers: z.boolean() });

export const DEFAULT_CONFIG: EventConfig = {
  eventName: "Brain Arena",
  format: "classic",
  knockoutPct: 25,
  rounds: [
    { id: "r1", game: "anagram", difficulty: "easy", timeLimitSec: 120 },
    { id: "r2", game: "sudoku", difficulty: "easy", timeLimitSec: 150 },
    { id: "r3", game: "wordhunt", difficulty: "med", timeLimitSec: 150 },
    { id: "r4", game: "numbercrunch", difficulty: "med", timeLimitSec: 120 },
  ],
  strikePenaltyAt: 2,
  strikeLockAt: 3,
  blockInternet: true,
};

/** Round countdown before a puzzle appears. */
export const COUNTDOWN_MS = 3500;
