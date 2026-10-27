import { createRng } from "../../rng";
import { vcErrors as E } from "@iedc/config/copy/vibecoding";
import type { ActionResult } from "../types";
import { SCORING, TASKS, TILE_IDS, tileConfig, hintsFor, type ScoredTileId, type TileId, type Variant } from "./config";
import { generatePuzzle, isSolved, slide } from "./puzzle";
import {
  ALL_TILE_IDS,
  PHASES,
  buildElapsed,
  buildRemaining,
  emptyFragment,
  type CheckResult,
  type CompetitionState,
  type FeedItem,
  type Fragment,
  type Phase,
  type Settings,
  type Team,
  type TileState,
} from "./state";
import { starterFragment } from "./tiles";
import { rankTeams } from "./scoring";

/* ------------------------------------------------------------------ */
/* Limits (spec sections 3, 6, 7)                                      */
/* ------------------------------------------------------------------ */

export const LIMITS = {
  askCap: 60,
  askWarnAt: 50,
  cooldownBaseSec: 40,
  cooldownPerQueuedSec: 5,
  cooldownMaxSec: 90,
  checkCooldownMs: 5_000,
  idleReleaseMs: 3 * 60_000,
  saveMax: 10,
  autoKeep: 5,
  hintMax: 3,
  autoSolveAfterMs: 12 * 60_000,
  autoSolveMax: 2,
  glitchFromMin: 50,
  glitchToMin: 70,
  notesMax: 500,
  feedKeep: 40,
} as const;

export const GLITCH_FRAGMENT: Fragment = {
  html: `<div data-glitch="true" style="padding:1rem;border:2px dashed var(--accent);border-radius:12px">☕ Bulbu spilled coffee on this section. Use Go Back.</div>`,
  css: "",
  js: "",
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export interface PersonInput {
  studentId: string;
  name: string;
  dept: string;
  sem: string;
  avatar: number;
}

export type Action =
  | { type: "person:join"; person: PersonInput }
  | { type: "team:create"; studentId: string; name: string }
  | { type: "team:join"; studentId: string; code: string }
  | { type: "team:leave"; studentId: string }
  | { type: "team:kick"; studentId: string; target: string }
  | { type: "team:rename"; studentId: string; name: string }
  | { type: "member:ready"; studentId: string; ready: boolean }
  | { type: "phase:set"; phase: Phase }
  | { type: "clock:pause" }
  | { type: "clock:resume" }
  | { type: "clock:extend"; minutes: number }
  | { type: "settings"; patch: Partial<Settings> }
  | { type: "tick" }
  | { type: "tile:open"; studentId: string; tileId: TileId }
  | { type: "tile:close"; studentId: string; tileId: TileId }
  | { type: "ask:begin"; studentId: string; tileId: TileId }
  | { type: "ask:deliver"; teamId: string; tileId: TileId; fragment: Fragment; queued: number }
  | { type: "ask:fail"; teamId: string }
  | { type: "check:begin"; studentId: string; tileId: TileId }
  | { type: "check:result"; teamId: string; tileId: TileId; result: CheckResult }
  | { type: "save:create"; studentId: string; tileId: TileId; note?: string }
  | { type: "save:restore"; studentId: string; tileId: TileId; saveId: string }
  | { type: "notes:update"; studentId: string; notes: string }
  | { type: "hint:use"; studentId: string; tileId: TileId }
  | { type: "autosolve:use"; studentId: string; tileId: TileId; reference: Fragment; result: CheckResult }
  | { type: "puzzle:move"; studentId: string; cell: number; version: number }
  | { type: "publish:begin"; studentId: string }
  | { type: "publish:result"; teamId: string; changePassed: boolean; slug: string }
  | { type: "vote"; studentId: string; teamId: string }
  | { type: "host:member"; op: "rename"; studentId: string; name: string }
  | { type: "host:member"; op: "move"; studentId: string; teamId: string }
  | { type: "host:member"; op: "remove"; studentId: string }
  | { type: "host:unlockTile"; teamId: string; tileId: ScoredTileId; reference: Fragment; result: CheckResult }
  | { type: "host:resetTeam"; teamId: string }
  | { type: "host:removeTeam"; teamId: string }
  | { type: "host:renameTeam"; teamId: string; name: string }
  | { type: "host:message"; teamId: string; text: string }
  | { type: "host:glitch"; teamId: string; fire: boolean }
  | { type: "host:spotlight"; teamId: string | null }
  | { type: "host:showcase"; teamId: string | null; voting?: boolean };

export interface Ctx {
  now: number;
}

export interface Result extends ActionResult {
  teamId?: string;
  glitched?: boolean;
  /** tiles that became done */
  completed?: TileId[];
  hint?: string;
  /** fresh board after a stale or bad puzzle move */
  board?: number[];
  version?: number;
}

const ok = (extra: Partial<Result> = {}): Result => ({ ok: true, ...extra });
const fail = (error: string, extra: Partial<Result> = {}): Result => ({ ok: false, error, ...extra });

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const variantOf = (s: CompetitionState, id: TileId): Variant => s.settings.variants[id] ?? tileConfig(id).variant;

export const teamOf = (s: CompetitionState, studentId: string): Team | null => {
  const tid = s.people[studentId]?.teamId;
  return tid ? (s.teams[tid] ?? null) : null;
};

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const nameTaken = (s: CompetitionState, name: string, except?: string) =>
  Object.values(s.teams).some((t) => t.id !== except && sameName(t.name, name));

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
export const isScored = (id: TileId): id is ScoredTileId => id !== "warmup";
export const doneCount = (t: Team) => TILE_IDS.filter((id) => t.tiles[id].doneAt != null).length;

/** Size factor for the team-size adjustment (spec 10.6). */
export function sizeFactor(n: number): number {
  const f = SCORING.sizeFactor as Record<string, number>;
  return f[String(Math.min(4, Math.max(2, n)))] ?? 1;
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "team"
  );
}

function newTile(id: TileId, variant: Variant): TileState {
  return {
    id,
    fragment: starterFragment(id, variant),
    firstOpenedAt: null,
    doneAt: null,
    autoSolved: false,
    hostUnlocked: false,
    asks: 0,
    asksToPass: null,
    hints: 0,
    saves: [],
    autos: [],
    savedBeforePass: false,
    usedGoBack: false,
    lastCheck: null,
    lastCheckAt: 0,
    holder: null,
    saveCounter: 0,
  };
}

export interface TeamInit {
  id: string;
  name: string;
  code: string;
  captain: string;
  createdAt: number;
  variants?: Settings["variants"];
}

/** A fresh team: shuffled board, piece permutation and glitch minute all come from its seed. */
export function createTeamState(seed: number, init: TeamInit): Team {
  const rng = createRng(seed);
  const order = rng.shuffle(TILE_IDS);
  const perm = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
  const glitchAt = (rng.range(LIMITS.glitchFromMin, LIMITS.glitchToMin - 1) * 60 + rng.int(60)) * 1000;
  const tiles = Object.fromEntries(
    ALL_TILE_IDS.map((id) => [id, newTile(id, init.variants?.[id] ?? tileConfig(id).variant)]),
  ) as Record<TileId, TileState>;
  return {
    id: init.id,
    name: init.name,
    code: init.code,
    seed,
    captain: init.captain,
    members: [],
    createdAt: init.createdAt,
    stage: "registered",
    tiles,
    order,
    perm,
    notes: "",
    notesBonus: null,
    cleanRewind: false,
    asksUsed: 0,
    askPending: null,
    cooldownUntil: 0,
    cooldownWaitMs: 0,
    autoSolves: 0,
    glitch: { at: glitchAt, armed: false, done: false, cancelled: false },
    puzzle: null,
    publish: null,
    changeRequest: null,
    message: null,
    version: 0,
  };
}

function feed(s: CompetitionState, kind: FeedItem["kind"], text: string, now: number, teamId?: string) {
  s.feed.push({ id: ++s.feedSeq, at: now, kind, text, teamId });
  if (s.feed.length > LIMITS.feedKeep) s.feed.splice(0, s.feed.length - LIMITS.feedKeep);
}

const touch = (s: CompetitionState, t?: Team | null) => {
  s.version++;
  if (t) t.version++;
};

function refreshStage(s: CompetitionState, t: Team) {
  if (t.stage !== "registered" && t.stage !== "ready") return;
  const ready = t.members.length >= s.settings.minTeamSize && t.members.every((m) => m.ready);
  t.stage = ready ? "ready" : "registered";
}

function removeMember(s: CompetitionState, t: Team, studentId: string) {
  t.members = t.members.filter((m) => m.studentId !== studentId);
  for (const id of ALL_TILE_IDS) if (t.tiles[id].holder?.studentId === studentId) t.tiles[id].holder = null;
  const p = s.people[studentId];
  if (p) p.teamId = null;
  if (t.members.length === 0) {
    delete s.teams[t.id];
    s.teamOrder = s.teamOrder.filter((id) => id !== t.id);
    if (s.spotlight === t.id) s.spotlight = null;
    return;
  }
  if (t.captain === studentId) t.captain = t.members[0].studentId;
  refreshStage(s, t);
}

function addMember(s: CompetitionState, t: Team, studentId: string, now: number) {
  const p = s.people[studentId];
  t.members.push({ studentId, name: p.name, dept: p.dept, sem: p.sem, avatar: p.avatar, joinedAt: now, ready: false });
  p.teamId = t.id;
  refreshStage(s, t);
}

const registrationOpen = (s: CompetitionState) => (s.phase === "registration" || s.phase === "warmup") && !s.settings.registrationLocked;

/** Is this tile editable right now (Ask, Save Point, Go Back, hints)? */
function editable(s: CompetitionState, tileId: TileId): string | null {
  if (tileId === "warmup") return s.phase === "warmup" ? null : E.tileLocked;
  if (s.phase === "frozen" || s.phase === "showcase" || s.phase === "closed") return E.frozen;
  if (s.phase !== "build") return E.tileLocked;
  if (s.clock.pausedAt != null) return E.paused;
  return null;
}

function autoSave(tile: TileState, now: number) {
  tile.autos.push({ id: `a${++tile.saveCounter}`, kind: "auto", label: "Auto", at: now, fragment: { ...tile.fragment } });
  if (tile.autos.length > LIMITS.autoKeep) tile.autos.splice(0, tile.autos.length - LIMITS.autoKeep);
}

/** A scored tile just passed (or was auto-solved / unlocked): pieces, notes bonus, puzzle start. */
function completeTile(s: CompetitionState, t: Team, tile: TileState, now: number): TileId[] {
  const at = buildElapsed(s.clock, now);
  tile.doneAt = at;
  tile.asksToPass = tile.asks;
  if (tile.usedGoBack && !tile.autoSolved && !tile.hostUnlocked) t.cleanRewind = true;
  const title = tileConfig(tile.id).title;
  if (!s.firstTileBy) {
    s.firstTileBy = t.id;
    feed(s, "badge", `First Blood! ${t.name} finished ${title}`, now, t.id);
  } else {
    feed(s, "tile", `${t.name} finished ${title}`, now, t.id);
  }
  const done = doneCount(t);
  if (done === SCORING.team.notesAtTile && t.notesBonus == null) t.notesBonus = wordCount(t.notes) >= SCORING.team.notesMinWords;
  if (done === TILE_IDS.length && !t.puzzle) {
    const { board, optimal } = generatePuzzle(t.seed ^ 0x51ed);
    t.puzzle = { board, optimal, moves: 0, startedAt: at, solvedAt: null, version: 0 };
    t.stage = "puzzle";
    feed(s, "puzzle", `${t.name} unlocked the puzzle`, now, t.id);
  }
  return [tile.id];
}

function holderGuard(s: CompetitionState, t: Team, tile: TileState, studentId: string): string | null {
  if (tile.holder?.studentId === studentId) return null;
  if (tile.holder) {
    const name = t.members.find((m) => m.studentId === tile.holder!.studentId)?.name ?? "A teammate";
    return E.heldBy(name);
  }
  return E.openTileFirst;
}

/* ------------------------------------------------------------------ */
/* The reducer                                                         */
/* ------------------------------------------------------------------ */

/** Apply one action. Mutates `s` (and bumps versions) only when it returns ok. */
export function applyAction(s: CompetitionState, a: Action, ctx: Ctx): Result {
  const now = ctx.now;
  switch (a.type) {
    case "person:join": {
      const prev = s.people[a.person.studentId];
      s.people[a.person.studentId] = { ...a.person, teamId: prev?.teamId ?? null, joinedAt: prev?.joinedAt ?? now };
      const t = teamOf(s, a.person.studentId);
      const m = t?.members.find((x) => x.studentId === a.person.studentId);
      if (m) Object.assign(m, { name: a.person.name, dept: a.person.dept, sem: a.person.sem, avatar: a.person.avatar });
      touch(s, t);
      return ok();
    }

    case "team:create": {
      const p = s.people[a.studentId];
      if (!p) return fail(E.joinFirst);
      if (p.teamId) return fail(E.alreadyInTeam);
      if (!registrationOpen(s)) return fail(E.registrationClosed);
      if (s.teamOrder.length >= s.settings.maxTeams) return fail(E.teamsFull);
      if (nameTaken(s, a.name)) return fail(E.nameTaken);
      const n = ++s.teamSeq;
      const seed = (s.seed ^ Math.imul(n, 0x2c1b3c6d)) >>> 0;
      const rng = createRng(seed ^ 0xc0de);
      let code = "";
      do code = Array.from({ length: 4 }, () => rng.pick(CODE_ALPHABET.split(""))).join("");
      while (Object.values(s.teams).some((t) => t.code === code));
      const t = createTeamState(seed, { id: `t${n}`, name: a.name, code, captain: a.studentId, createdAt: now, variants: s.settings.variants });
      if (s.phase === "build") t.stage = "tiles";
      s.teams[t.id] = t;
      s.teamOrder.push(t.id);
      addMember(s, t, a.studentId, now);
      feed(s, "team", `${t.name} is in!`, now, t.id);
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "team:join": {
      const p = s.people[a.studentId];
      if (!p) return fail(E.joinFirst);
      if (p.teamId) return fail(E.alreadyInTeam);
      if (!registrationOpen(s)) return fail(E.registrationClosed);
      const t = Object.values(s.teams).find((x) => x.code === a.code);
      if (!t) return fail(E.badCode);
      if (t.members.length >= s.settings.maxTeamSize) return fail(E.teamFull(s.settings.maxTeamSize));
      addMember(s, t, a.studentId, now);
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "team:leave": {
      const t = teamOf(s, a.studentId);
      if (!t) return fail(E.notInTeam);
      if (!registrationOpen(s)) return fail(E.notNow);
      removeMember(s, t, a.studentId);
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "team:kick": {
      const t = teamOf(s, a.studentId);
      if (!t) return fail(E.notInTeam);
      if (t.captain !== a.studentId) return fail(E.captainOnly);
      if (!registrationOpen(s) || a.target === a.studentId) return fail(E.notNow);
      if (!t.members.some((m) => m.studentId === a.target)) return fail(E.notNow);
      removeMember(s, t, a.target);
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "team:rename": {
      const t = teamOf(s, a.studentId);
      if (!t) return fail(E.notInTeam);
      if (t.captain !== a.studentId) return fail(E.captainOnly);
      if (!registrationOpen(s)) return fail(E.notNow);
      if (nameTaken(s, a.name, t.id)) return fail(E.nameTaken);
      t.name = a.name;
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "member:ready": {
      const t = teamOf(s, a.studentId);
      if (!t) return fail(E.notInTeam);
      const m = t.members.find((x) => x.studentId === a.studentId)!;
      m.ready = a.ready;
      refreshStage(s, t);
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "phase:set": {
      const from = PHASES.indexOf(s.phase);
      const to = PHASES.indexOf(a.phase);
      if (to <= from) return fail(E.notNow);
      s.phase = a.phase;
      if (a.phase === "warmup") feed(s, "info", "Warm-up! Practise Ask, Save Point and Go Back.", now);
      if (a.phase === "build") {
        s.clock = { durationMs: s.settings.buildMinutes * 60_000, extendMs: 0, startedAt: now, pausedAt: null, pausedMs: 0 };
        for (const t of Object.values(s.teams)) {
          t.stage = "tiles";
          t.tiles.warmup.holder = null;
          t.askPending = null;
          t.cooldownUntil = 0;
          // tiles nobody touched get the starter of their (possibly changed) variant
          for (const id of TILE_IDS) {
            const tile = t.tiles[id];
            if (tile.asks === 0 && tile.saves.length === 0 && tile.autos.length === 0) tile.fragment = starterFragment(id, variantOf(s, id));
          }
          t.version++;
        }
        feed(s, "info", "The build clock is running. Go!", now);
      }
      if (a.phase === "frozen") {
        if (s.clock.startedAt != null && s.clock.pausedAt == null) s.clock.pausedAt = now;
        for (const t of Object.values(s.teams)) {
          for (const id of ALL_TILE_IDS) t.tiles[id].holder = null;
          t.askPending = null;
          t.version++;
        }
        feed(s, "info", "Time! The build is frozen.", now);
      }
      if (a.phase === "showcase") s.showcaseAt = now;
      if (a.phase === "closed") s.votingOpen = false;
      touch(s);
      return ok();
    }

    case "clock:pause": {
      if (s.phase !== "build" || s.clock.pausedAt != null) return fail(E.notNow);
      s.clock.pausedAt = now;
      feed(s, "info", "Clock paused.", now);
      touch(s);
      return ok();
    }
    case "clock:resume": {
      if (s.phase !== "build" || s.clock.pausedAt == null) return fail(E.notNow);
      const pausedFor = now - s.clock.pausedAt;
      s.clock.pausedMs += pausedFor;
      s.clock.pausedAt = null;
      // cooldowns don't run down while paused
      for (const t of Object.values(s.teams)) if (t.cooldownUntil > now - pausedFor) t.cooldownUntil += pausedFor;
      feed(s, "info", "Clock running again.", now);
      touch(s);
      return ok();
    }
    case "clock:extend": {
      if (s.phase !== "build") return fail(E.notNow);
      s.clock.extendMs += a.minutes * 60_000;
      feed(s, "info", `+${a.minutes} minutes on the clock!`, now);
      touch(s);
      return ok();
    }

    case "settings": {
      Object.assign(s.settings, a.patch);
      if (a.patch.variants) s.settings.variants = { ...a.patch.variants };
      if (a.patch.buildMinutes != null) s.clock.durationMs = a.patch.buildMinutes * 60_000;
      if (s.settings.minTeamSize > s.settings.maxTeamSize) s.settings.minTeamSize = s.settings.maxTeamSize;
      for (const t of Object.values(s.teams)) refreshStage(s, t);
      touch(s);
      return ok();
    }

    case "tick": {
      let changed = false;
      if (s.phase === "build" && s.clock.pausedAt == null) {
        if (buildRemaining(s.clock, now) <= 0) return applyAction(s, { type: "phase:set", phase: "frozen" }, ctx);
        if (!s.standingsAt60 && buildElapsed(s.clock, now) >= SCORING.comebackAtMinute * 60_000) {
          s.standingsAt60 = rankTeams(s, now).map((r) => r.teamId);
          changed = true;
        }
      }
      for (const t of Object.values(s.teams)) {
        for (const id of ALL_TILE_IDS) {
          const h = t.tiles[id].holder;
          if (h && now - h.lastActive > LIMITS.idleReleaseMs) {
            t.tiles[id].holder = null;
            t.version++;
            changed = true;
          }
        }
      }
      if (changed) s.version++;
      return ok();
    }

    case "tile:open": {
      const t = teamOf(s, a.studentId);
      if (!t) return fail(E.notInTeam);
      if (a.tileId === "warmup" ? s.phase !== "warmup" : s.phase !== "build") return fail(s.phase === "frozen" ? E.frozen : E.tileLocked);
      const tile = t.tiles[a.tileId];
      if (tile.holder && tile.holder.studentId !== a.studentId && now - tile.holder.lastActive <= LIMITS.idleReleaseMs) {
        return fail(holderGuard(s, t, tile, a.studentId)!);
      }
      for (const id of ALL_TILE_IDS) if (id !== a.tileId && t.tiles[id].holder?.studentId === a.studentId) t.tiles[id].holder = null;
      tile.holder = { studentId: a.studentId, since: now, lastActive: now };
      if (isScored(a.tileId) && tile.firstOpenedAt == null) tile.firstOpenedAt = buildElapsed(s.clock, now);
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "tile:close": {
      const t = teamOf(s, a.studentId);
      if (!t) return fail(E.notInTeam);
      const tile = t.tiles[a.tileId];
      if (tile.holder?.studentId !== a.studentId) return ok({ teamId: t.id });
      tile.holder = null;
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "ask:begin": {
      const t = teamOf(s, a.studentId);
      if (!t) return fail(E.notInTeam);
      const blocked = editable(s, a.tileId);
      if (blocked) return fail(blocked);
      const tile = t.tiles[a.tileId];
      const g = holderGuard(s, t, tile, a.studentId);
      if (g) return fail(g);
      if (t.askPending) return fail(E.askPending);
      if (now < t.cooldownUntil) return fail(E.cooldown(Math.ceil((t.cooldownUntil - now) / 1000)));
      if (s.phase === "build" && t.asksUsed >= LIMITS.askCap) return fail(E.askCap);
      t.askPending = { tileId: a.tileId, by: a.studentId, since: now };
      tile.holder!.lastActive = now;
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "ask:deliver": {
      const t = s.teams[a.teamId];
      if (!t || t.askPending?.tileId !== a.tileId) return fail(E.notNow);
      t.askPending = null;
      const tile = t.tiles[a.tileId];
      if (editable(s, a.tileId) === E.frozen || editable(s, a.tileId) === E.tileLocked) {
        touch(s, t);
        return fail(E.frozen);
      }
      const scoredBuild = s.phase === "build" && isScored(a.tileId);
      autoSave(tile, now);
      if (scoredBuild && s.settings.glitch && !t.glitch.done && !t.glitch.cancelled) {
        const el = buildElapsed(s.clock, now);
        if (t.glitch.armed || (el >= t.glitch.at && el < LIMITS.glitchToMin * 60_000)) {
          t.glitch.done = true;
          t.glitch.armed = false;
          tile.fragment = { ...GLITCH_FRAGMENT };
          feed(s, "glitch", `☕ Bulbu spilled coffee on ${t.name}'s ${tileConfig(a.tileId).title}!`, now, t.id);
          touch(s, t);
          return ok({ teamId: t.id, glitched: true });
        }
      }
      tile.fragment = { html: a.fragment.html, css: a.fragment.css, js: a.fragment.js };
      if (scoredBuild) {
        tile.asks++;
        t.asksUsed++;
      }
      const cd = Math.min(LIMITS.cooldownMaxSec, LIMITS.cooldownBaseSec + LIMITS.cooldownPerQueuedSec * Math.max(0, a.queued)) * 1000;
      t.cooldownUntil = now + cd;
      if (s.phase === "build") t.cooldownWaitMs += cd;
      if (tile.holder) tile.holder.lastActive = now;
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "ask:fail": {
      const t = s.teams[a.teamId];
      if (!t) return fail(E.notNow);
      t.askPending = null;
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "check:begin": {
      const t = teamOf(s, a.studentId);
      if (!t) return fail(E.notInTeam);
      if (a.tileId === "warmup" ? s.phase !== "warmup" : s.phase !== "build") return fail(s.phase === "frozen" ? E.frozen : E.tileLocked);
      const tile = t.tiles[a.tileId];
      if (now - tile.lastCheckAt < LIMITS.checkCooldownMs) return fail(E.checkCooldown);
      tile.lastCheckAt = now;
      if (tile.holder?.studentId === a.studentId) tile.holder.lastActive = now;
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "check:result": {
      const t = s.teams[a.teamId];
      if (!t) return fail(E.notNow);
      const tile = t.tiles[a.tileId];
      const passedBefore = tile.lastCheck != null && tile.lastCheck.passed === tile.lastCheck.total;
      tile.lastCheck = a.result;
      let completed: TileId[] = [];
      const allPass = a.result.total > 0 && a.result.passed === a.result.total;
      if (allPass && isScored(a.tileId) && tile.doneAt == null && s.phase === "build") completed = completeTile(s, t, tile, now);
      if (allPass && !passedBefore && a.tileId === "warmup" && s.phase === "warmup") feed(s, "info", `${t.name} passed the warm-up`, now, t.id);
      touch(s, t);
      return ok({ teamId: t.id, completed });
    }

    case "save:create": {
      const t = teamOf(s, a.studentId);
      if (!t) return fail(E.notInTeam);
      const blocked = editable(s, a.tileId);
      if (blocked) return fail(blocked);
      const tile = t.tiles[a.tileId];
      if (tile.saves.length >= LIMITS.saveMax) return fail(E.saveLimit);
      const n = tile.saves.length + 1;
      tile.saves.push({ id: `s${++tile.saveCounter}`, kind: "save", label: `Save Point ${n}`, note: a.note || undefined, at: now, fragment: { ...tile.fragment } });
      if (tile.doneAt == null) tile.savedBeforePass = true;
      if (tile.holder?.studentId === a.studentId) tile.holder.lastActive = now;
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "save:restore": {
      const t = teamOf(s, a.studentId);
      if (!t) return fail(E.notInTeam);
      const blocked = editable(s, a.tileId);
      if (blocked) return fail(blocked);
      const tile = t.tiles[a.tileId];
      const g = holderGuard(s, t, tile, a.studentId);
      if (g) return fail(g);
      if (t.askPending?.tileId === a.tileId) return fail(E.askPending);
      const sp = [...tile.saves, ...tile.autos].find((x) => x.id === a.saveId);
      if (!sp) return fail(E.noSuchSave);
      const fragment = { ...sp.fragment };
      autoSave(tile, now);
      tile.fragment = fragment;
      tile.usedGoBack = true;
      tile.holder!.lastActive = now;
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "notes:update": {
      const t = teamOf(s, a.studentId);
      if (!t) return fail(E.notInTeam);
      if (s.phase === "frozen" || s.phase === "showcase" || s.phase === "closed") return fail(E.frozen);
      t.notes = a.notes.slice(0, LIMITS.notesMax);
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "hint:use": {
      const t = teamOf(s, a.studentId);
      if (!t) return fail(E.notInTeam);
      const blocked = editable(s, a.tileId);
      if (blocked) return fail(blocked);
      const tile = t.tiles[a.tileId];
      if (tile.hints >= LIMITS.hintMax) return fail(E.noHints);
      const hint = hintsFor(a.tileId)[tile.hints];
      tile.hints++;
      touch(s, t);
      return ok({ teamId: t.id, hint });
    }

    case "autosolve:use": {
      const t = teamOf(s, a.studentId);
      if (!t) return fail(E.notInTeam);
      if (!isScored(a.tileId)) return fail(E.notNow);
      const blocked = editable(s, a.tileId);
      if (blocked) return fail(blocked);
      const tile = t.tiles[a.tileId];
      if (tile.doneAt != null) return fail(E.alreadyDone);
      if (t.autoSolves >= LIMITS.autoSolveMax) return fail(E.autoSolveUsed);
      const el = buildElapsed(s.clock, now);
      if (tile.firstOpenedAt == null || el - tile.firstOpenedAt < LIMITS.autoSolveAfterMs) return fail(E.autoSolveNotYet(LIMITS.autoSolveAfterMs / 60_000));
      if (t.askPending?.tileId === a.tileId) return fail(E.askPending);
      autoSave(tile, now);
      tile.fragment = { ...a.reference };
      tile.autoSolved = true;
      tile.lastCheck = a.result;
      t.autoSolves++;
      const completed = completeTile(s, t, tile, now);
      touch(s, t);
      return ok({ teamId: t.id, completed });
    }

    case "puzzle:move": {
      const t = teamOf(s, a.studentId);
      if (!t) return fail(E.notInTeam);
      if (s.phase !== "build") return fail(s.phase === "frozen" ? E.frozen : E.notNow);
      if (s.clock.pausedAt != null) return fail(E.paused);
      const p = t.puzzle;
      if (!p) return fail(E.puzzleNotReady);
      if (p.solvedAt != null) return fail(E.notNow, { board: p.board, version: p.version });
      if (a.version !== p.version) return fail(E.puzzleStale, { board: p.board, version: p.version });
      const next = slide(p.board, a.cell);
      if (!next) return fail(E.puzzleBadMove, { board: p.board, version: p.version });
      p.board = next;
      p.moves++;
      p.version++;
      if (isSolved(next)) {
        p.solvedAt = buildElapsed(s.clock, now);
        feed(s, "puzzle", `${t.name} solved the puzzle in ${p.moves} moves`, now, t.id);
      }
      touch(s, t);
      return ok({ teamId: t.id, board: p.board, version: p.version });
    }

    case "publish:begin": {
      const t = teamOf(s, a.studentId);
      if (!t) return fail(E.notInTeam);
      if (s.phase !== "build") return fail(s.phase === "frozen" ? E.frozen : E.notNow);
      if (s.clock.pausedAt != null) return fail(E.paused);
      if (!t.puzzle?.solvedAt) return fail(E.publishNotReady);
      return ok({ teamId: t.id });
    }

    case "publish:result": {
      const t = s.teams[a.teamId];
      if (!t) return fail(E.notNow);
      const at = buildElapsed(s.clock, now);
      if (!t.publish) {
        t.publish = { firstAt: at, adjustedAt: Math.round(at * sizeFactor(t.members.length)), lastAt: at, count: 1, slug: a.slug };
        const rng = createRng(t.seed ^ 0xc4a7);
        t.changeRequest = { variant: rng.pick(TASKS.changeRequests).id, sentAt: at, doneAt: null };
        t.stage = "change_request";
        const firstEver = Object.values(s.teams).filter((x) => x.publish).length === 1;
        feed(s, "publish", firstEver ? `🚀 ${t.name} published first!` : `🚀 ${t.name} published their site`, now, t.id);
      } else {
        t.publish.lastAt = at;
        t.publish.count++;
        if (t.changeRequest && t.changeRequest.doneAt == null && a.changePassed) {
          t.changeRequest.doneAt = at;
          t.stage = "done";
          feed(s, "change", `${t.name} handled the client's change request`, now, t.id);
        }
      }
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "vote": {
      if (s.phase !== "showcase" || !s.votingOpen) return fail(E.votingClosed);
      const p = s.people[a.studentId];
      if (!p) return fail(E.joinFirst);
      if (!s.teams[a.teamId]?.publish) return fail(E.noSuchTeam);
      if (p.teamId === a.teamId) return fail(E.ownTeam);
      if (s.votes[a.studentId]) return fail(E.alreadyVoted);
      s.votes[a.studentId] = a.teamId;
      touch(s);
      return ok();
    }

    case "host:member": {
      const p = s.people[a.studentId];
      if (!p) return fail(E.joinFirst);
      const t = teamOf(s, a.studentId);
      if (a.op === "rename") {
        p.name = a.name;
        const m = t?.members.find((x) => x.studentId === a.studentId);
        if (m) m.name = a.name;
        touch(s, t);
        return ok({ teamId: t?.id });
      }
      if (a.op === "remove") {
        if (!t) return fail(E.notInTeam);
        removeMember(s, t, a.studentId);
        touch(s, t);
        return ok({ teamId: t.id });
      }
      const to = s.teams[a.teamId];
      if (!to) return fail(E.noSuchTeam);
      if (to === t) return ok({ teamId: to.id });
      if (to.members.length >= s.settings.maxTeamSize) return fail(E.teamFull(s.settings.maxTeamSize));
      if (t) {
        removeMember(s, t, a.studentId);
        t.version++;
      }
      addMember(s, to, a.studentId, now);
      touch(s, to);
      return ok({ teamId: to.id });
    }

    case "host:unlockTile": {
      const t = s.teams[a.teamId];
      if (!t) return fail(E.noSuchTeam);
      if (s.phase !== "build") return fail(E.notNow);
      const tile = t.tiles[a.tileId];
      if (tile.doneAt != null) return fail(E.alreadyDone);
      autoSave(tile, now);
      tile.fragment = { ...a.reference };
      tile.hostUnlocked = true;
      tile.lastCheck = a.result;
      if (tile.firstOpenedAt == null) tile.firstOpenedAt = buildElapsed(s.clock, now);
      const completed = completeTile(s, t, tile, now);
      touch(s, t);
      return ok({ teamId: t.id, completed });
    }

    case "host:resetTeam": {
      const t = s.teams[a.teamId];
      if (!t) return fail(E.noSuchTeam);
      const fresh = createTeamState(t.seed, { id: t.id, name: t.name, code: t.code, captain: t.captain, createdAt: t.createdAt, variants: s.settings.variants });
      fresh.members = t.members;
      fresh.version = t.version + 1;
      if (s.phase === "build" || s.phase === "frozen") {
        fresh.stage = "tiles";
        for (const id of TILE_IDS) fresh.tiles[id].fragment = starterFragment(id, variantOf(s, id));
      } else refreshStage(s, fresh);
      s.teams[t.id] = fresh;
      touch(s, fresh);
      return ok({ teamId: t.id });
    }

    case "host:removeTeam": {
      const t = s.teams[a.teamId];
      if (!t) return fail(E.noSuchTeam);
      for (const m of t.members) if (s.people[m.studentId]) s.people[m.studentId].teamId = null;
      delete s.teams[t.id];
      s.teamOrder = s.teamOrder.filter((id) => id !== t.id);
      if (s.spotlight === t.id) s.spotlight = null;
      touch(s);
      return ok({ teamId: t.id });
    }

    case "host:renameTeam": {
      const t = s.teams[a.teamId];
      if (!t) return fail(E.noSuchTeam);
      if (nameTaken(s, a.name, t.id)) return fail(E.nameTaken);
      t.name = a.name;
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "host:message": {
      const t = s.teams[a.teamId];
      if (!t) return fail(E.noSuchTeam);
      t.message = a.text ? { text: a.text, at: now } : null;
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "host:glitch": {
      const t = s.teams[a.teamId];
      if (!t) return fail(E.noSuchTeam);
      if (a.fire) {
        if (t.glitch.done) return fail(E.notNow);
        t.glitch.armed = true;
        t.glitch.cancelled = false;
      } else {
        t.glitch.armed = false;
        t.glitch.cancelled = true;
      }
      touch(s, t);
      return ok({ teamId: t.id });
    }

    case "host:spotlight": {
      if (a.teamId && !s.teams[a.teamId]) return fail(E.noSuchTeam);
      s.spotlight = a.teamId;
      touch(s);
      return ok();
    }

    case "host:showcase": {
      if (a.teamId && !s.teams[a.teamId]) return fail(E.noSuchTeam);
      s.showcaseTeam = a.teamId;
      if (a.voting != null) {
        if (a.voting && s.phase !== "showcase") return fail(E.notNow);
        s.votingOpen = a.voting;
      }
      touch(s);
      return ok();
    }
  }
}

/** Every check passing on a tile → a CheckResult with all items true (used by Safe Mode / unlock). */
export function allPassed(itemIds: string[], now: number): CheckResult {
  return { items: Object.fromEntries(itemIds.map((i) => [i, true])), passed: itemIds.length, total: itemIds.length, at: now };
}

export { emptyFragment };
