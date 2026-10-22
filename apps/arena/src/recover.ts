import { anonKey, monthKey, type HistoryTournament, type MonthlyFile } from "@iedc/shared";

/**
 * Rebuilds a lost tournament from the published monthly.json, which keeps each
 * student's name, dept, sem, points and an anonymous key (a hash of their
 * Student ID) but not the ID itself.
 *
 * Students who have since joined again on this laptop are in students.json with
 * their real ID; where anonKey(id) matches a key, the recovered entry uses that
 * real ID so their points add up with later tournaments. Everyone else keeps
 * their points under a placeholder ID.
 *
 * Only for a month that had exactly one tournament (otherwise the standings mix
 * several tournaments and can't be split apart).
 */
export function recoverTournament(
  monthly: MonthlyFile,
  month: string,
  knownStudentIds: string[],
  id = `recovered-${month}`,
): { tournament: HistoryTournament; matched: number; unmatched: number } {
  const m = monthly.months[month];
  if (!m) throw new Error(`monthly.json has no month ${month}`);
  if (m.tournaments.length !== 1) throw new Error(`${month} has ${m.tournaments.length} tournaments; can only recover a month with exactly one`);
  const byKey = new Map(knownStudentIds.map((sid) => [anonKey(sid), sid]));
  let matched = 0;
  const players = m.standings.map((row, i) => {
    const real = byKey.get(row.key);
    if (real) matched++;
    return {
      studentId: real ?? `recovered:${row.key}`,
      name: row.name,
      dept: row.dept,
      sem: row.sem,
      score: row.best,
      rank: i + 1,
      solves: 0,
    };
  });
  const t = m.tournaments[0];
  return {
    tournament: { id, name: t.name, date: t.date, month: monthKey(t.date), included: true, players },
    matched,
    unmatched: players.length - matched,
  };
}
