import { TILE_IDS, tileConfig } from "./config";
import { awards, badges, rankTeams, teamScore, voteCounts } from "./scoring";
import type { CompetitionState } from "./state";

/**
 * The results export (spec 13.5). Contains Student IDs: it is written to the
 * laptop's private data folder only.
 */
export interface TeamResult {
  rank: number;
  team: string;
  teamId: string;
  size: number;
  members: { name: string; studentId: string; dept: string; sem: string }[];
  score: number;
  breakdown: { tiles: Record<string, number>; team: Record<string, number> };
  publishMin: number | null;
  publishAdjustedMin: number | null;
  publishCount: number;
  cooldownWaitMin: number;
  asks: number;
  hints: number;
  savePoints: number;
  /** hand edits of the code */
  codeEdits: number;
  autoSolves: number;
  tiles: Record<string, { done: boolean; minutes: number | null; asks: number; hints: number; savePoints: number; help: "show-me" | "host" | null; checks: string }>;
  notes: string;
  puzzle: { optimal: number; moves: number; seconds: number | null } | null;
  changeRequest: { variant: string; minutes: number | null } | null;
  badges: string[];
  votes: number;
}

const min = (ms: number | null | undefined) => (ms == null ? null : Math.round((ms / 60_000) * 100) / 100);

export function buildResults(s: CompetitionState) {
  const ranked = rankTeams(s);
  const votes = voteCounts(s);
  const rows: TeamResult[] = ranked.map((r) => {
    const t = s.teams[r.teamId];
    const sc = teamScore(s, t);
    const tiles = Object.fromEntries(
      TILE_IDS.map((id) => {
        const x = t.tiles[id];
        return [
          id,
          {
            done: x.doneAt != null,
            minutes: x.doneAt != null && x.firstOpenedAt != null ? min(x.doneAt - x.firstOpenedAt) : null,
            asks: x.asks,
            hints: x.hints,
            savePoints: x.saves.length,
            help: x.autoSolved ? ("show-me" as const) : x.hostUnlocked ? ("host" as const) : null,
            checks: x.lastCheck ? `${x.lastCheck.passed}/${x.lastCheck.total}` : "",
          },
        ];
      }),
    );
    return {
      rank: r.rank,
      team: t.name,
      teamId: t.id,
      size: t.members.length,
      members: t.members.map((m) => ({ name: m.name, studentId: m.studentId, dept: m.dept, sem: m.sem })),
      score: sc.total,
      breakdown: {
        tiles: Object.fromEntries(Object.entries(sc.tiles).map(([k, v]) => [k, v.points])),
        team: Object.fromEntries(sc.team.map((l) => [l.label, l.points])),
      },
      publishMin: min(t.publish?.firstAt),
      publishAdjustedMin: min(t.publish?.adjustedAt),
      publishCount: t.publish?.count ?? 0,
      cooldownWaitMin: min(t.cooldownWaitMs) ?? 0,
      asks: t.asksUsed,
      hints: TILE_IDS.reduce((n, id) => n + t.tiles[id].hints, 0),
      savePoints: TILE_IDS.reduce((n, id) => n + t.tiles[id].saves.length, 0),
      codeEdits: TILE_IDS.reduce((n, id) => n + (t.tiles[id].edits ?? 0), 0),
      autoSolves: t.autoSolves,
      tiles,
      notes: t.notes,
      puzzle: t.puzzle ? { optimal: t.puzzle.optimal, moves: t.puzzle.moves, seconds: t.puzzle.solvedAt != null ? Math.round((t.puzzle.solvedAt - t.puzzle.startedAt) / 1000) : null } : null,
      changeRequest: t.changeRequest ? { variant: t.changeRequest.variant, minutes: t.changeRequest.doneAt != null ? min(t.changeRequest.doneAt - t.changeRequest.sentAt) : null } : null,
      badges: badges(s, t),
      votes: votes[t.id] ?? 0,
    };
  });
  return { runId: s.runId, phase: s.phase, exportedAt: new Date().toISOString(), teams: rows, awards: awards(s) };
}

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per team; tile columns use the tile titles. */
export function resultsCsv(results: ReturnType<typeof buildResults>): string {
  const head = [
    "Rank",
    "Team",
    "Size",
    "Members",
    "Student IDs",
    "Departments",
    "Score",
    "Publish (min)",
    "Publish adjusted (min)",
    "Asks",
    "Hints",
    "Save Points",
    "Code edits",
    "Show me",
    "Cooldown wait (min)",
    ...TILE_IDS.map((id) => `${tileConfig(id).title} (min)`),
    "Puzzle moves",
    "Puzzle optimal",
    "Puzzle (s)",
    "Change request (min)",
    "Badges",
    "Votes",
    "Notes",
  ];
  const lines = results.teams.map((r) =>
    [
      r.rank,
      r.team,
      r.size,
      r.members.map((m) => m.name).join("; "),
      r.members.map((m) => m.studentId).join("; "),
      r.members.map((m) => m.dept).join("; "),
      r.score,
      r.publishMin,
      r.publishAdjustedMin,
      r.asks,
      r.hints,
      r.savePoints,
      r.codeEdits,
      r.autoSolves,
      r.cooldownWaitMin,
      ...TILE_IDS.map((id) => (r.tiles[id].done ? (r.tiles[id].minutes ?? "") : "")),
      r.puzzle?.moves ?? "",
      r.puzzle?.optimal ?? "",
      r.puzzle?.seconds ?? "",
      r.changeRequest?.minutes ?? "",
      r.badges.join("; "),
      r.votes,
      r.notes,
    ]
      .map(cell)
      .join(","),
  );
  return [head.map(cell).join(","), ...lines].join("\n") + "\n";
}
