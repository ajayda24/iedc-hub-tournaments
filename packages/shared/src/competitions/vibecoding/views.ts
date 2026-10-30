import { EVENT, TASKS, TILE_IDS, checklist, hintsFor, tileConfig, type TileId } from "./config";
import type { ClockView, HealthView, HostTeam, HostView, PersonView, TeamView, TileView, WallTeam, WallView } from "./protocol";
import { LIMITS, currentHash, isScored, variantOf } from "./rules";
import { awards, badges, publishRanks, rankTeams, teamScore, voteCounts } from "./scoring";
import { buildElapsed, buildRemaining, type CompetitionState, type Team } from "./state";

/** Runtime facts the pure state doesn't hold (who is online, the AI's health, join URLs). */
export interface RuntimeInfo {
  now: number;
  online: Set<string>;
  internet: Set<string>;
  health: HealthView;
  joinUrls: WallView["joinUrls"];
  laptopInternet: boolean | null;
  dataDir: string;
  /** the port published sites are really served on */
  sitesPort?: number;
}

export const sitePath = (slug: string) => `/s/${slug}/`;

export function clockView(s: CompetitionState, now: number): ClockView {
  const c = s.clock;
  return {
    phase: s.phase,
    elapsedMs: buildElapsed(c, now),
    remainingMs: c.startedAt == null ? c.durationMs + c.extendMs : buildRemaining(c, now),
    totalMs: c.durationMs + c.extendMs,
    paused: c.pausedAt != null,
    at: now,
  };
}

/** Revealed picture pieces: completing TILE_IDS[k] reveals perm[k]. */
export const revealedPieces = (t: Team) => TILE_IDS.flatMap((id, k) => (t.tiles[id].doneAt != null ? [t.perm[k]] : []));

export function wallView(s: CompetitionState, rt: Pick<RuntimeInfo, "now" | "health" | "joinUrls" | "sitesPort">): WallView {
  const ranked = rankTeams(s);
  const pr = publishRanks(s);
  const teams: WallTeam[] = ranked.map((r) => {
    const t = s.teams[r.teamId];
    return {
      id: t.id,
      name: t.name,
      size: t.members.length,
      members: t.members.map((m) => m.name),
      stage: t.stage,
      tilesDone: revealedPieces(t).length,
      revealed: revealedPieces(t),
      score: teamScore(s, t, pr).total,
      rank: r.rank,
      badges: badges(s, t),
      sitePath: t.publish ? sitePath(t.publish.slug) : null,
      puzzleSolved: t.puzzle?.solvedAt != null,
      publishedAt: t.publish?.firstAt ?? null,
    };
  });
  const showAwards = s.phase === "showcase" || s.phase === "closed";
  const okModels = rt.health.models.filter((m) => m.status === "ok" || m.status === "busy").length;
  return {
    title: EVENT.title,
    projectName: EVENT.projectName,
    clock: clockView(s, rt.now),
    registrationLocked: s.settings.registrationLocked,
    teams,
    feed: s.feed.slice(-8),
    spotlight: s.spotlight,
    showcaseTeam: s.showcaseTeam,
    votingOpen: s.votingOpen,
    votes: s.phase === "closed" ? voteCounts(s) : null,
    awards: showAwards ? awards(s) : null,
    health: { safeMode: rt.health.safeMode, asksPerMin: rt.health.asksPerMin, modelsOk: okModels, modelsTotal: rt.health.models.length },
    sitesPort: rt.sitesPort || EVENT.sitesPort,
    joinUrls: rt.joinUrls,
    settings: { minTeamSize: s.settings.minTeamSize, maxTeamSize: s.settings.maxTeamSize, buildMinutes: s.settings.buildMinutes, allowCodeEdit: s.settings.allowCodeEdit !== false },
  };
}

function tileView(s: CompetitionState, t: Team, id: TileId, now: number): TileView {
  const tile = t.tiles[id];
  const cfg = tileConfig(id);
  const variant = variantOf(s, id);
  const hints = hintsFor(id);
  const k = TILE_IDS.indexOf(id as (typeof TILE_IDS)[number]);
  const holderName = tile.holder ? (t.members.find((m) => m.studentId === tile.holder!.studentId)?.name ?? "?") : null;
  return {
    id,
    title: cfg.title,
    emoji: cfg.emoji,
    brief: cfg.brief,
    par: cfg.par,
    variant,
    checklist: checklist(id, variant).map((i) => ({ ...i, pass: tile.lastCheck ? (tile.lastCheck.items[i.id] ?? false) : null })),
    fragment: tile.fragment,
    done: tile.doneAt != null,
    autoSolved: tile.autoSolved || tile.hostUnlocked,
    asks: tile.asks,
    edits: tile.edits ?? 0,
    hintsUsed: hints.slice(0, tile.hints),
    hintsLeft: LIMITS.hintMax - tile.hints,
    saves: [...tile.saves, ...tile.autos]
      .sort((a, b) => b.at - a.at)
      .map(({ fragment, ...rest }) => ({
        id: rest.id,
        kind: rest.kind,
        label: rest.label,
        note: rest.note,
        detail: rest.detail,
        at: rest.at,
        current: fragment.html === tile.fragment.html && fragment.css === tile.fragment.css && fragment.js === tile.fragment.js,
        text: fragment.html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 70),
        cssChars: fragment.css.length,
        jsChars: fragment.js.length,
      })),
    holder: tile.holder && holderName ? { studentId: tile.holder.studentId, name: holderName } : null,
    firstOpenedAt: tile.firstOpenedAt,
    doneAt: tile.doneAt,
    autoSolveAt: isScored(id) && tile.firstOpenedAt != null ? tile.firstOpenedAt + LIMITS.autoSolveAfterMs : null,
    checkReadyAt: tile.lastCheckAt + LIMITS.checkCooldownMs,
    piece: k >= 0 ? t.perm[k] : null,
  };
}

export function teamView(s: CompetitionState, t: Team, rt: Pick<RuntimeInfo, "now" | "online" | "internet">, rank?: number): TeamView {
  const score = teamScore(s, t);
  const cr = t.changeRequest ? TASKS.changeRequests.find((c) => c.id === t.changeRequest!.variant)! : null;
  return {
    id: t.id,
    name: t.name,
    code: t.code,
    captain: t.captain,
    members: t.members.map((m) => ({ ...m, online: rt.online.has(m.studentId) })),
    stage: t.stage,
    notes: t.notes,
    asksUsed: t.asksUsed,
    askCap: LIMITS.askCap,
    askWarnAt: LIMITS.askWarnAt,
    cooldownUntil: t.cooldownUntil,
    askPending: t.askPending,
    autoSolves: t.autoSolves,
    autoSolveMax: LIMITS.autoSolveMax,
    tiles: (["warmup", ...t.order] as TileId[]).map((id) => tileView(s, t, id, rt.now)),
    puzzle: t.puzzle
      ? { board: t.puzzle.board, moves: t.puzzle.moves, optimal: t.puzzle.optimal, startedAt: t.puzzle.startedAt, solvedAt: t.puzzle.solvedAt, version: t.puzzle.version }
      : null,
    publish: t.publish
      ? {
          sitePath: sitePath(t.publish.slug),
          firstAt: t.publish.firstAt,
          rank: publishRanks(s).get(t.id) ?? 0,
          count: t.publish.count,
          lastAt: t.publish.lastAt,
          stale: t.publish.hash != null && t.publish.hash !== currentHash(t),
        }
      : null,
    changeRequest: t.changeRequest && cr ? { text: cr.text, phrase: cr.phrase, sentAt: t.changeRequest.sentAt, doneAt: t.changeRequest.doneAt } : null,
    message: t.message,
    score,
    rank: rank ?? rankTeams(s).find((r) => r.teamId === t.id)?.rank ?? 0,
    badges: badges(s, t),
    blockedMembers: t.members.filter((m) => rt.internet.has(m.studentId)).map((m) => m.studentId),
  };
}

export function personView(s: CompetitionState, studentId: string): PersonView | null {
  const p = s.people[studentId];
  return p ? { studentId, name: p.name, dept: p.dept, sem: p.sem, avatar: p.avatar, teamId: p.teamId } : null;
}

export function hostView(s: CompetitionState, rt: RuntimeInfo): HostView {
  const ranked = rankTeams(s);
  const rankOf = new Map(ranked.map((r) => [r.teamId, r.rank]));
  const teams: HostTeam[] = s.teamOrder
    .map((id) => s.teams[id])
    .filter(Boolean)
    .map((t) => ({ ...teamView(s, t, rt, rankOf.get(t.id)), seed: t.seed, cooldownWaitMs: t.cooldownWaitMs, glitch: t.glitch }));
  return {
    settings: s.settings,
    runId: s.runId,
    teams,
    people: Object.keys(s.people).map((id) => ({ ...personView(s, id)!, online: rt.online.has(id), internet: rt.internet.has(id) })),
    health: rt.health,
    votes: voteCounts(s),
    laptopInternet: rt.laptopInternet,
    dataDir: rt.dataDir,
  };
}
