import { COUNTDOWN_MS, DEFAULT_EVENT } from "@iedc/data/rules";
import { site } from "@iedc/data/site";
import type { CheckStatus, Difficulty, GameId, Reveal, RoundOptions } from "./games/types";

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
  studentCheck: "student:check",
  hostStudents: "host:students",
  hostResetPin: "host:resetPin",
  hostUnlockStudent: "host:unlockStudent",
  hostHistory: "host:history",
  hostHistoryEdit: "host:historyEdit",
  hostRecord: "host:record",
  hostExportMonthly: "host:exportMonthly",
  hostBackupHistory: "host:backupHistory",
  hostImportHistory: "host:importHistory",
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

/** Edit these lists in data/people.ts */
export { DEPARTMENTS, SEMESTERS } from "@iedc/data/people";

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
  /** clients must run the internet probe and freeze play when it succeeds */
  blockInternet: boolean;
  /** what the host will start next (a teaser for the lobby / results screens) */
  nextRound: RoundConfig | null;
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
  studentId: string;
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
  studentId: string;
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
/* Inbound payloads (validated with the zod schemas in ./schemas)      */
/* ------------------------------------------------------------------ */

export interface HelloPayload {
  role: Role;
  token?: string;
  pin?: string;
}

export interface HelloAck {
  ok: boolean;
  error?: string;
  serverNow: number;
  me?: MeState | null;
}

export interface JoinPayload {
  token: string;
  /** college Student ID (or admission / roll no.), upper-cased */
  studentId: string;
  /** PIN: created on first join, checked after */
  pin: string;
  name: string;
  sem: string;
  dept: string;
  avatar: number;
}

export interface JoinAck {
  ok: boolean;
  error?: string;
  /** too many wrong PINs: this Student ID is locked for a while */
  locked?: boolean;
  me?: MeState;
}

export interface SubmitAck {
  ok: boolean;
  error?: string;
  status?: CheckStatus;
  feedback?: unknown;
  message?: string;
  progress?: unknown;
  points?: number;
}

export interface CheatPayload {
  kind: CheatKind;
  detail?: string;
  ms?: number;
}

/** Edit the defaults in data/rules.ts and data/site.ts */
export const DEFAULT_CONFIG: EventConfig = { eventName: site.defaultEventName, ...DEFAULT_EVENT };

/** Round countdown before a puzzle appears (data/rules.ts). */
export { COUNTDOWN_MS };

/* ------------------------------------------------------------------ */
/* Students & monthly leaderboard                                      */
/* ------------------------------------------------------------------ */

export interface StudentCheckAck {
  ok: boolean;
  error?: string;
  /** a PIN already exists for this ID: ask for it instead of creating one */
  exists?: boolean;
  lockedUntil?: number | null;
}

/** A student as the host console sees them (never the PIN) */
export interface StudentInfo {
  studentId: string;
  name: string;
  dept: string;
  sem: string;
  hasPin: boolean;
  createdAt: number;
  pinSetAt: number | null;
  pinResetAt: number | null;
  lastSeenAt: number;
  lockedUntil: number | null;
}
