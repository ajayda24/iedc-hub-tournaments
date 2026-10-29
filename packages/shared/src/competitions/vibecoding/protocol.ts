import type { ScoredTileId, TileId, Variant } from "./config";
import type { CheckResult, FeedItem, Fragment, Member, Phase, Settings, Stage } from "./state";

/** Socket.IO namespace shared by every competition. */
export const COMPETITIONS_NAMESPACE = "/competitions";

/** Event names on the /competitions namespace (vibecoding). */
export const EVC = {
  // anyone → server
  hello: "hello",
  ping: "ping",
  studentCheck: "student:check",
  join: "join",
  // player → server
  teamCreate: "team:create",
  teamJoin: "team:join",
  teamLeave: "team:leave",
  teamKick: "team:kick",
  teamRename: "team:rename",
  memberReady: "member:ready",
  tileOpen: "tile:open",
  tileClose: "tile:close",
  askSend: "ask:send",
  checkRun: "check:run",
  saveCreate: "save:create",
  saveRestore: "save:restore",
  codeEdit: "code:edit",
  savePreview: "save:preview",
  notesUpdate: "notes:update",
  hintUse: "hint:use",
  autosolveUse: "autosolve:use",
  puzzleMove: "puzzle:move",
  publishGo: "publish:go",
  voteCast: "vote:cast",
  internet: "net:internet",
  // host → server
  hostSettings: "host:settings",
  hostPhase: "host:phase",
  hostPause: "host:pause",
  hostResume: "host:resume",
  hostExtend: "host:extend",
  hostMember: "host:member",
  hostTeam: "host:team",
  hostModel: "host:model",
  hostGeminiKey: "host:geminiKey",
  hostShowcase: "host:showcase",
  hostExport: "host:export",
  hostNewRun: "host:newRun",
  hostSpotlight: "host:spotlight",
  // server → clients
  wall: "wall",
  me: "me",
  team: "team",
  host: "host",
  toast: "toast",
  bumped: "bumped",
} as const;

export type CompetitionRole = "player" | "host" | "screen";

export interface CHelloAck {
  ok: boolean;
  error?: string;
  serverNow: number;
  me?: PersonView | null;
}

export interface PersonView {
  studentId: string;
  name: string;
  dept: string;
  sem: string;
  avatar: number;
  teamId: string | null;
}

/* ---------------- public wall (projector + every phone) ---------------- */

export interface ClockView {
  phase: Phase;
  /** build ms elapsed */
  elapsedMs: number;
  remainingMs: number;
  totalMs: number;
  paused: boolean;
  /** server time this view was made, so clients can tick locally */
  at: number;
}

export interface WallTeam {
  id: string;
  name: string;
  size: number;
  members: string[];
  stage: Stage;
  tilesDone: number;
  /** pieces (1..8) revealed so far */
  revealed: number[];
  score: number;
  rank: number;
  badges: string[];
  /** path on the sites port, once published */
  sitePath: string | null;
  puzzleSolved: boolean;
  publishedAt: number | null;
}

export interface ModelHealthView {
  id: string;
  label: string;
  role: "primary" | "overflow";
  status: "ok" | "busy" | "paused" | "disabled" | "limit";
  usedToday: number;
  rpd: number;
  lastMinute: number;
  rpm: number;
  errors: number;
  lastError?: string;
}

export interface HealthView {
  safeMode: boolean;
  /** Safe Mode was switched on automatically because no model answers */
  autoSafe: boolean;
  keySet: boolean;
  provider: "gemini" | "mock";
  models: ModelHealthView[];
  queued: number;
  inFlight: number;
  asksPerMin: number;
  /** check runner job time, 95th percentile (ms) */
  checkP95Ms: number;
}

export interface AwardView {
  id: string;
  title: string;
  teamId: string | null;
  teamName: string | null;
  detail: string;
}

export interface WallView {
  title: string;
  projectName: string;
  clock: ClockView;
  registrationLocked: boolean;
  teams: WallTeam[];
  feed: FeedItem[];
  spotlight: string | null;
  showcaseTeam: string | null;
  votingOpen: boolean;
  votes: Record<string, number> | null;
  awards: AwardView[] | null;
  health: Pick<HealthView, "safeMode" | "asksPerMin"> & { modelsOk: number; modelsTotal: number };
  sitesPort: number;
  joinUrls: { label: string; url: string; qrSvg: string }[];
  settings: { minTeamSize: number; maxTeamSize: number; buildMinutes: number; allowCodeEdit: boolean };
}

/* ---------------- a team's own board (members only) ---------------- */

export interface SaveView {
  id: string;
  kind: "save" | "auto";
  label: string;
  note?: string;
  /** auto-saves: the Ask (first words) or Save Point that replaced this version */
  detail?: string;
  at: number;
  /** this version is exactly the code the tile has now */
  current: boolean;
  /** tiny summary: the visible text, and how much CSS/JS it has */
  text: string;
  cssChars: number;
  jsChars: number;
}

export interface TileView {
  id: TileId;
  title: string;
  emoji: string;
  brief: string;
  par: number;
  variant: Variant;
  checklist: { id: string; text: string; pass: boolean | null }[];
  fragment: Fragment;
  done: boolean;
  autoSolved: boolean;
  asks: number;
  /** hand edits */
  edits: number;
  hintsUsed: string[];
  hintsLeft: number;
  saves: SaveView[];
  holder: { studentId: string; name: string } | null;
  firstOpenedAt: number | null;
  doneAt: number | null;
  /** build ms when auto-solve becomes available (null = not yet opened) */
  autoSolveAt: number | null;
  /** epoch ms, Check cooldown */
  checkReadyAt: number;
  /** puzzle piece this tile reveals (scored tiles) */
  piece: number | null;
}

export interface ScoreLine {
  label: string;
  points: number;
}

export interface TeamScore {
  total: number;
  tiles: Record<ScoredTileId, { points: number; lines: ScoreLine[] }>;
  team: ScoreLine[];
}

export interface TeamView {
  id: string;
  name: string;
  code: string;
  captain: string;
  members: (Member & { online: boolean })[];
  stage: Stage;
  notes: string;
  asksUsed: number;
  askCap: number;
  askWarnAt: number;
  cooldownUntil: number;
  askPending: { tileId: TileId; by: string; since: number } | null;
  autoSolves: number;
  autoSolveMax: number;
  /** warm-up first, then the 8 tiles in this team's board order */
  tiles: TileView[];
  puzzle: { board: number[]; moves: number; optimal: number; startedAt: number; solvedAt: number | null; version: number } | null;
  publish: { sitePath: string; firstAt: number; rank: number; count: number; lastAt: number; stale: boolean } | null;
  changeRequest: { text: string; phrase: string; sentAt: number; doneAt: number | null } | null;
  message: { text: string; at: number } | null;
  score: TeamScore;
  rank: number;
  badges: string[];
  /** Asks are blocked: this phone reported internet (per member) */
  blockedMembers: string[];
}

/* ---------------- host ---------------- */

export interface HostTeam extends TeamView {
  seed: number;
  cooldownWaitMs: number;
  glitch: { at: number; armed: boolean; done: boolean; cancelled: boolean };
}

export interface HostView {
  settings: Settings;
  runId: string;
  teams: HostTeam[];
  people: (PersonView & { online: boolean; internet: boolean })[];
  health: HealthView;
  votes: Record<string, number>;
  laptopInternet: boolean | null;
  dataDir: string;
}

/* ---------------- results of async actions ---------------- */

export interface AskAck {
  ok: boolean;
  error?: string;
  /** the AI's short explanation */
  explanation?: string;
  check?: CheckResult;
  backup?: boolean;
  glitched?: boolean;
}

export interface CheckAck {
  ok: boolean;
  error?: string;
  check?: CheckResult;
  done?: boolean;
}

export interface PublishAck {
  ok: boolean;
  error?: string;
  /** friendly reasons the site check failed */
  problems?: { tileId: ScoredTileId | "page" | "change"; title: string; items: string[] }[];
  sitePath?: string;
}

/** Glossary reveal at the end: friendly word → real term. */
export type Glossary = { friendly: string; real: string }[];
