/**
 * Monthly leaderboard maths. Used by the arena (host preview + export) and
 * by tests; the website only reads the exported file.
 */
export interface HistoryPlayer {
  studentId: string;
  name: string;
  dept: string;
  sem: string;
  score: number;
  rank: number;
  solves: number;
}

export interface HistoryTournament {
  id: string;
  name: string;
  /** when it finished (ms) */
  date: number;
  /** "YYYY-MM" in the laptop's local time */
  month: string;
  /** counts towards the monthly leaderboard */
  included: boolean;
  players: HistoryPlayer[];
}

export interface MonthlyRow {
  /** anonymous, stable id for the student (never the Student ID itself) */
  key: string;
  name: string;
  dept: string;
  sem: string;
  points: number;
  played: number;
  wins: number;
  best: number;
}

export interface MonthlyDept {
  dept: string;
  players: number;
  points: number;
  avg: number;
}

export interface MonthlyMonth {
  tournaments: { name: string; date: number; players: number }[];
  standings: MonthlyRow[];
  depts: MonthlyDept[];
}

export interface MonthlyFile {
  /** ISO date-time of the export */
  updatedAt: string;
  months: Record<string, MonthlyMonth>;
}

export type MonthlyMethod = "points" | "rankPoints";

export function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Short, stable, non-reversible-at-a-glance key (FNV-1a) so the public file never shows Student IDs. */
export function anonKey(studentId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < studentId.length; i++) {
    h ^= studentId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export function computeMonth(
  tournaments: HistoryTournament[],
  opts: { method: MonthlyMethod; rankPoints: number[] },
): MonthlyMonth {
  const used = tournaments.filter((t) => t.included).sort((a, b) => a.date - b.date);
  const rows = new Map<string, MonthlyRow>();
  for (const t of used) {
    for (const p of t.players) {
      const pts = opts.method === "rankPoints" ? opts.rankPoints[p.rank - 1] ?? 0 : Math.max(0, p.score);
      const r = rows.get(p.studentId) ?? { key: anonKey(p.studentId), name: p.name, dept: p.dept, sem: p.sem, points: 0, played: 0, wins: 0, best: 0 };
      // latest tournament wins for name/dept/sem (people fix typos)
      Object.assign(r, { name: p.name, dept: p.dept, sem: p.sem });
      r.points += pts;
      r.played++;
      if (p.rank === 1) r.wins++;
      r.best = Math.max(r.best, p.score);
      rows.set(p.studentId, r);
    }
  }
  const standings = [...rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || b.best - a.best || a.name.localeCompare(b.name));
  const deptMap = new Map<string, { players: number; points: number }>();
  for (const r of standings) {
    const d = deptMap.get(r.dept) ?? { players: 0, points: 0 };
    d.players++;
    d.points += r.points;
    deptMap.set(r.dept, d);
  }
  const depts = [...deptMap.entries()]
    .map(([dept, d]) => ({ dept, players: d.players, points: d.points, avg: Math.round(d.points / d.players) }))
    .sort((a, b) => b.avg - a.avg || b.players - a.players);
  return { tournaments: used.map((t) => ({ name: t.name, date: t.date, players: t.players.length })), standings, depts };
}

/** The file published to the website: every month that has at least one included tournament. */
export function buildMonthlyFile(
  history: HistoryTournament[],
  opts: { method: MonthlyMethod; rankPoints: number[]; monthsShown: number; now?: number },
): MonthlyFile {
  const byMonth = new Map<string, HistoryTournament[]>();
  for (const t of history) {
    if (!t.included) continue;
    byMonth.set(t.month, [...(byMonth.get(t.month) ?? []), t]);
  }
  const months: Record<string, MonthlyMonth> = {};
  for (const m of [...byMonth.keys()].sort().reverse().slice(0, opts.monthsShown)) {
    months[m] = computeMonth(byMonth.get(m)!, opts);
  }
  return { updatedAt: new Date(opts.now ?? Date.now()).toISOString(), months };
}

/** Merge an imported history backup: same tournament id is kept once (existing wins). */
export function mergeHistory(current: HistoryTournament[], incoming: HistoryTournament[]): { merged: HistoryTournament[]; added: number } {
  const ids = new Set(current.map((t) => t.id));
  const fresh = incoming.filter((t) => t && typeof t.id === "string" && !ids.has(t.id));
  return { merged: [...current, ...fresh].sort((a, b) => a.date - b.date), added: fresh.length };
}
