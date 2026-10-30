import { SCORING, TASKS, TILE_IDS, tileConfig, type ScoredTileId } from "./config";
import { piecesInPlace } from "./puzzle";
import type { CompetitionState, Team } from "./state";
import type { AwardView, ScoreLine, TeamScore } from "./protocol";

/** Spec section 10. Every number comes from config/competitions/vibecoding/scoring.json. */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const T = SCORING.tile;
const S = SCORING.team;

export function speedPoints(minutes: number, par: number): number {
  return Math.round(T.speedMax * clamp01((2 * par - minutes) / par));
}

export function efficiencyPoints(asks: number): number {
  if (asks <= 3) return T.efficiency.upTo3;
  if (asks === 4) return T.efficiency.is4;
  if (asks === 5) return T.efficiency.is5;
  return T.efficiency.from6;
}

export function tileScore(team: Team, id: ScoredTileId): { points: number; lines: ScoreLine[] } {
  const tile = team.tiles[id];
  if (tile.doneAt == null) {
    const c = tile.lastCheck;
    const pts = c && c.total > 0 ? Math.floor((T.partialMax * c.passed) / c.total) : 0;
    return { points: pts, lines: pts ? [{ label: "Partial", points: pts }] : [] };
  }
  if (tile.autoSolved) return { points: T.autoSolvedBase, lines: [{ label: "Show me", points: T.autoSolvedBase }] };
  if (tile.hostUnlocked) return { points: T.base, lines: [{ label: "Unlocked by host", points: T.base }] };
  const lines: ScoreLine[] = [{ label: "Done", points: T.base }];
  const minutes = (tile.doneAt - (tile.firstOpenedAt ?? tile.doneAt)) / 60_000;
  const speed = speedPoints(minutes, tileConfig(id).par);
  if (speed) lines.push({ label: "Speed", points: speed });
  const eff = efficiencyPoints(tile.asksToPass ?? tile.asks);
  if (eff) lines.push({ label: "Few Asks", points: eff });
  if (tile.savedBeforePass) lines.push({ label: "Save Point", points: T.savePointBonus });
  if (tile.hints) lines.push({ label: "Hints", points: -Math.min(T.hintCostMax, tile.hints * T.hintCost) });
  const sum = lines.reduce((n, l) => n + l.points, 0);
  return { points: Math.max(0, sum), lines };
}

/** Publish rank of each published team, by size-adjusted time (earlier raw time breaks ties). */
export function publishRanks(s: CompetitionState): Map<string, number> {
  const published = Object.values(s.teams)
    .filter((t) => t.publish)
    .sort((a, b) => a.publish!.adjustedAt - b.publish!.adjustedAt || a.publish!.firstAt - b.publish!.firstAt);
  return new Map(published.map((t, i) => [t.id, i + 1]));
}

export function rankBonus(rank: number): number {
  return S.publishRankBonus[rank - 1] ?? S.publishRankBonusLater;
}

export function puzzleTimePoints(seconds: number, optimal: number): number {
  const q = S.puzzleTimeBaseSec + S.puzzleTimePerMoveSec * optimal;
  return Math.round(S.puzzleTimeMax * clamp01((2 * q - seconds) / q));
}

export function teamScore(s: CompetitionState, t: Team, ranks = publishRanks(s)): TeamScore {
  const tiles = Object.fromEntries(TILE_IDS.map((id) => [id, tileScore(t, id)])) as TeamScore["tiles"];
  const team: ScoreLine[] = [];
  if (t.notesBonus) team.push({ label: "Project Notes", points: S.notesBonus });
  if (t.cleanRewind) team.push({ label: "Clean Rewind", points: S.cleanRewind });
  const p = t.puzzle;
  if (p?.solvedAt != null) {
    team.push({ label: "Puzzle solved", points: S.puzzleSolved });
    const time = puzzleTimePoints((p.solvedAt - p.startedAt) / 1000, p.optimal);
    if (time) team.push({ label: "Puzzle speed", points: time });
    const moves = Math.round(S.puzzleMovesMax * clamp01(p.optimal / Math.max(1, p.moves)));
    if (moves) team.push({ label: "Puzzle moves", points: moves });
  } else if (p) {
    const part = Math.floor((S.puzzlePartialMax * piecesInPlace(p.board)) / 8);
    if (part) team.push({ label: "Puzzle (partial)", points: part });
  }
  if (t.publish) {
    team.push({ label: "Published", points: S.publish });
    const r = ranks.get(t.id);
    if (r) team.push({ label: `Publish rank #${r}`, points: rankBonus(r) });
  }
  const cr = t.changeRequest;
  if (cr?.doneAt != null) {
    const min = (cr.doneAt - cr.sentAt) / 60_000;
    if (min <= S.changeRequestFastMin) team.push({ label: "Change request", points: S.changeRequestFast });
    else if (min <= S.changeRequestSlowMin) team.push({ label: "Change request", points: S.changeRequestSlow });
  }
  const total = Object.values(tiles).reduce((n, x) => n + x.points, 0) + team.reduce((n, l) => n + l.points, 0);
  return { total, tiles, team };
}

export interface Ranked {
  teamId: string;
  total: number;
  rank: number;
}

/** Higher score, then earlier size-adjusted publish, then fewer Asks, then earlier puzzle solve (spec 10.3). */
export function rankTeams(s: CompetitionState, _now?: number): Ranked[] {
  const ranks = publishRanks(s);
  const rows = s.teamOrder
    .map((id) => s.teams[id])
    .filter(Boolean)
    .map((t) => ({ t, total: teamScore(s, t, ranks).total }));
  const inf = Number.POSITIVE_INFINITY;
  rows.sort(
    (a, b) =>
      b.total - a.total ||
      (a.t.publish?.adjustedAt ?? inf) - (b.t.publish?.adjustedAt ?? inf) ||
      a.t.asksUsed - b.t.asksUsed ||
      (a.t.puzzle?.solvedAt ?? inf) - (b.t.puzzle?.solvedAt ?? inf),
  );
  return rows.map((r, i) => ({ teamId: r.t.id, total: r.total, rank: i + 1 }));
}

/* ---------------- badges (no points) ---------------- */

export const BADGES = {
  firstBlood: "First Blood",
  quickDraw: "Quick Draw",
  saveHero: "Save Hero",
  cleanRewind: "Clean Rewind",
  notesNinja: "Notes Ninja",
  puzzlePro: "Puzzle Pro",
  zeroHints: "Zero Hints",
  firstToPublish: "First to Publish",
  clientPleaser: "Client Pleaser",
} as const;

export function badges(s: CompetitionState, t: Team): string[] {
  const out: string[] = [];
  const tiles = TILE_IDS.map((id) => t.tiles[id]);
  if (s.firstTileBy === t.id) out.push(BADGES.firstBlood);
  if (tiles.some((x) => x.doneAt != null && !x.autoSolved && !x.hostUnlocked && x.asksToPass === 1)) out.push(BADGES.quickDraw);
  if (tiles.filter((x) => x.saves.length > 0).length >= 6) out.push(BADGES.saveHero);
  if (t.cleanRewind) out.push(BADGES.cleanRewind);
  if (t.notesBonus) out.push(BADGES.notesNinja);
  if (t.puzzle?.solvedAt != null && t.puzzle.moves <= t.puzzle.optimal + 2) out.push(BADGES.puzzlePro);
  if (t.puzzle && tiles.every((x) => x.hints === 0)) out.push(BADGES.zeroHints);
  const firstPub = Object.values(s.teams)
    .filter((x) => x.publish)
    .sort((a, b) => a.publish!.firstAt - b.publish!.firstAt)[0];
  if (firstPub?.id === t.id) out.push(BADGES.firstToPublish);
  const cr = t.changeRequest;
  if (cr?.doneAt != null && (cr.doneAt - cr.sentAt) / 60_000 <= S.changeRequestFastMin) out.push(BADGES.clientPleaser);
  return out;
}

/* ---------------- awards (spec 10.5) ---------------- */

export function voteCounts(s: CompetitionState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const teamId of Object.values(s.votes)) out[teamId] = (out[teamId] ?? 0) + 1;
  return out;
}

export function awards(s: CompetitionState): AwardView[] {
  const ranked = rankTeams(s);
  const name = (id: string | null | undefined) => (id ? (s.teams[id]?.name ?? null) : null);
  const teams = Object.values(s.teams);
  const published = teams.filter((t) => t.publish);
  const award = (id: string, title: string, teamId: string | null, detail: string): AwardView => ({ id, title, teamId, teamName: name(teamId), detail });
  const fmt = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}`;
  const out: AwardView[] = [];

  const champ = ranked[0];
  out.push(award("champion", "Champion", champ?.teamId ?? null, champ ? `${champ.total} points` : ""));

  const fastest = [...published].sort((a, b) => a.publish!.adjustedAt - b.publish!.adjustedAt)[0];
  out.push(award("fastest", "Fastest Publish", fastest?.id ?? null, fastest ? `${fmt(fastest.publish!.firstAt)} (adjusted ${fmt(fastest.publish!.adjustedAt)})` : ""));

  const small = published.filter((t) => t.members.length === 2).sort((a, b) => a.publish!.firstAt - b.publish!.firstAt)[0];
  out.push(award("small", "Fastest Small Team", small?.id ?? null, small ? fmt(small.publish!.firstAt) : ""));

  const rankOf = new Map(ranked.map((r) => [r.teamId, r.rank]));
  const clean = [...published].sort((a, b) => a.asksUsed - b.asksUsed || rankOf.get(a.id)! - rankOf.get(b.id)!)[0];
  out.push(award("clean", "Cleanest Asks", clean?.id ?? null, clean ? `${clean.asksUsed} Asks` : ""));

  const votes = voteCounts(s);
  const best = Object.entries(votes).sort((a, b) => b[1] - a[1] || rankOf.get(a[0])! - rankOf.get(b[0])!)[0];
  out.push(award("looks", "Best-Looking Site", best?.[0] ?? null, best ? `${best[1]} votes` : ""));

  let comeback: { id: string; gain: number } | null = null;
  if (s.standingsAt60) {
    for (const r of ranked) {
      const before = s.standingsAt60.indexOf(r.teamId);
      if (before < 0) continue;
      const gain = before + 1 - r.rank;
      if (gain > 0 && (!comeback || gain > comeback.gain)) comeback = { id: r.teamId, gain };
    }
  }
  out.push(award("comeback", "Comeback", comeback?.id ?? null, comeback ? `up ${comeback.gain} places since minute ${SCORING.comebackAtMinute}` : ""));
  return out;
}

export const changeRequestText = (variant: string) => TASKS.changeRequests.find((c) => c.id === variant)!;
