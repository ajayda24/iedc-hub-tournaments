import type { ScoredTileId, TileId, Variant } from "./config";
import { EVENT, TILE_IDS } from "./config";

/** One section of the page: what the AI writes and the checks test. */
export interface Fragment {
  html: string;
  css: string;
  js: string;
}

export type Phase = "setup" | "registration" | "warmup" | "build" | "frozen" | "showcase" | "closed";
export const PHASES: Phase[] = ["setup", "registration", "warmup", "build", "frozen", "showcase", "closed"];

export type Stage = "registered" | "ready" | "tiles" | "puzzle" | "published" | "change_request" | "done";

/** The build clock. Times used for scoring are "build ms": elapsed clock time, pauses excluded. */
export interface Clock {
  durationMs: number;
  extendMs: number;
  /** epoch ms when BUILD started */
  startedAt: number | null;
  /** epoch ms when the current pause began */
  pausedAt: number | null;
  /** total paused ms so far */
  pausedMs: number;
}

export interface Member {
  studentId: string;
  name: string;
  dept: string;
  sem: string;
  avatar: number;
  joinedAt: number;
  ready: boolean;
}

/** A student who joined the competition (in a team or not yet). */
export interface Person extends Omit<Member, "ready" | "joinedAt"> {
  teamId: string | null;
  joinedAt: number;
}

export interface SavePoint {
  id: string;
  kind: "save" | "auto";
  label: string;
  note?: string;
  /** epoch ms */
  at: number;
  fragment: Fragment;
}

export interface CheckResult {
  /** checklist item id → passed */
  items: Record<string, boolean>;
  passed: number;
  total: number;
  /** epoch ms */
  at: number;
}

export interface TileState {
  id: TileId;
  fragment: Fragment;
  /** build ms the tile was first opened (scored tiles) */
  firstOpenedAt: number | null;
  /** build ms it first passed every check */
  doneAt: number | null;
  autoSolved: boolean;
  /** completed by the host: base points only */
  hostUnlocked: boolean;
  /** delivered Asks on this tile, total */
  asks: number;
  /** delivered Asks when it passed (frozen at that moment) */
  asksToPass: number | null;
  hints: number;
  saves: SavePoint[];
  autos: SavePoint[];
  /** a manual Save Point existed before it passed */
  savedBeforePass: boolean;
  usedGoBack: boolean;
  lastCheck: CheckResult | null;
  /** epoch ms of the last Check, for the 5 s cooldown */
  lastCheckAt: number;
  holder: { studentId: string; since: number; lastActive: number } | null;
  saveCounter: number;
  /** code edits by hand (not Asks) */
  edits?: number;
}

export interface Puzzle {
  /** 9 cells: piece 1..8, 0 = the empty slot. Solved = [1,2,3,4,5,6,7,8,0] */
  board: number[];
  optimal: number;
  moves: number;
  /** build ms */
  startedAt: number;
  solvedAt: number | null;
  version: number;
}

export interface Publish {
  /** build ms of the first successful publish */
  firstAt: number;
  /** firstAt × sizeFactor(team size), used for the rank bonus, award and tie-break */
  adjustedAt: number;
  lastAt: number;
  count: number;
  slug: string;
}

export interface ChangeRequest {
  variant: string;
  /** build ms */
  sentAt: number;
  doneAt: number | null;
}

export interface Team {
  id: string;
  name: string;
  /** 4-character join code */
  code: string;
  seed: number;
  captain: string;
  members: Member[];
  createdAt: number;
  stage: Stage;
  tiles: Record<TileId, TileState>;
  /** board order of the 8 tiles (per-team shuffle) */
  order: ScoredTileId[];
  /** perm[k] = the picture piece (1..8) revealed by completing TILE_IDS[k] */
  perm: number[];
  notes: string;
  /** decided when the 4th tile completes */
  notesBonus: boolean | null;
  cleanRewind: boolean;
  asksUsed: number;
  /** an Ask on its way to the AI */
  askPending: { tileId: TileId; by: string; since: number } | null;
  /** epoch ms; no new Ask before this */
  cooldownUntil: number;
  /** total ms members spent waiting on the cooldown (logged for size calibration) */
  cooldownWaitMs: number;
  autoSolves: number;
  /** glitch: when it may fire (build ms), whether it already did, or was cancelled */
  glitch: { at: number; armed: boolean; done: boolean; cancelled: boolean };
  puzzle: Puzzle | null;
  publish: Publish | null;
  changeRequest: ChangeRequest | null;
  /** host message shown to the team */
  message: { text: string; at: number } | null;
  version: number;
}

export interface FeedItem {
  id: number;
  at: number;
  kind: "tile" | "badge" | "publish" | "glitch" | "puzzle" | "team" | "info" | "change";
  text: string;
  teamId?: string;
}

export interface Settings {
  buildMinutes: number;
  glitch: boolean;
  minTeamSize: number;
  maxTeamSize: number;
  maxTeams: number;
  registrationLocked: boolean;
  /** tile variants (defaults come from tasks.json) */
  variants: Partial<Record<TileId, Variant>>;
  /** return reference fragments instead of calling the AI */
  safeMode: boolean;
  /** the laptop is meant to have internet (router mode): don't warn about it */
  allowHostInternet: boolean;
  /** keep the students' Ask text in the export */
  logPrompts: boolean;
  /** students may edit a tile's HTML/CSS/JS by hand (free: no Ask, no cooldown) */
  allowCodeEdit: boolean;
}

export interface CompetitionState {
  v: 1;
  runId: string;
  seed: number;
  phase: Phase;
  clock: Clock;
  settings: Settings;
  people: Record<string, Person>;
  /** device token → studentId, so a phone reconnects (even after a restart) without re-entering the PIN */
  devices: Record<string, string>;
  teams: Record<string, Team>;
  /** team ids in creation order */
  teamOrder: string[];
  teamSeq: number;
  feed: FeedItem[];
  feedSeq: number;
  firstTileBy: string | null;
  /** studentId → teamId */
  votes: Record<string, string>;
  /** team ids by rank at minute 60 of the build (for the Comeback award) */
  standingsAt60: string[] | null;
  /** pinned on the wall by the host */
  spotlight: string | null;
  /** epoch ms when the showcase started */
  showcaseAt: number | null;
  /** host's "show this site full screen" */
  showcaseTeam: string | null;
  votingOpen: boolean;
  version: number;
}

export const emptyFragment = (): Fragment => ({ html: "", css: "", js: "" });

export function defaultSettings(): Settings {
  const d = EVENT.defaults;
  return {
    buildMinutes: d.buildMinutes,
    glitch: d.glitch,
    minTeamSize: d.minTeamSize,
    maxTeamSize: d.maxTeamSize,
    maxTeams: d.maxTeams,
    registrationLocked: false,
    variants: {},
    safeMode: false,
    allowHostInternet: true,
    logPrompts: false,
    allowCodeEdit: true,
  };
}

export function createState(seed: number, now: number): CompetitionState {
  const s = defaultSettings();
  return {
    v: 1,
    runId: `vc-${new Date(now).toISOString().slice(0, 16).replace(/[-:T]/g, "")}-${(seed >>> 0).toString(36).slice(0, 4)}`,
    seed: seed >>> 0,
    phase: "setup",
    clock: { durationMs: s.buildMinutes * 60_000, extendMs: 0, startedAt: null, pausedAt: null, pausedMs: 0 },
    settings: s,
    people: {},
    devices: {},
    teams: {},
    teamOrder: [],
    teamSeq: 0,
    feed: [],
    feedSeq: 0,
    firstTileBy: null,
    votes: {},
    standingsAt60: null,
    spotlight: null,
    showcaseAt: null,
    showcaseTeam: null,
    votingOpen: false,
    version: 0,
  };
}

/* ---------------- clock ---------------- */

/** Build ms elapsed (pauses excluded). 0 before BUILD starts. */
export function buildElapsed(c: Clock, now: number): number {
  if (c.startedAt == null) return 0;
  return Math.max(0, (c.pausedAt ?? now) - c.startedAt - c.pausedMs);
}
export function buildRemaining(c: Clock, now: number): number {
  return Math.max(0, c.durationMs + c.extendMs - buildElapsed(c, now));
}

export const ALL_TILE_IDS: TileId[] = ["warmup", ...TILE_IDS];
