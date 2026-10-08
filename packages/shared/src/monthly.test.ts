import { describe, expect, it } from "vitest";
import { buildMonthlyFile, computeMonth, mergeHistory, monthKey, type HistoryTournament } from "./monthly";

const p = (studentId: string, score: number, rank: number, name = studentId, dept = "CSE") => ({ studentId, name, dept, sem: "S3", score, rank, solves: 1 });
const t = (id: string, date: string, players: ReturnType<typeof p>[], included = true): HistoryTournament => ({
  id,
  name: `Event ${id}`,
  date: new Date(date).getTime(),
  month: monthKey(new Date(date).getTime()),
  included,
  players,
});

const opts = { method: "points" as const, rankPoints: [25, 18, 15], monthsShown: 12 };

describe("monthly leaderboard", () => {
  it("adds up scores across a month's tournaments, keyed by Student ID", () => {
    const m = computeMonth(
      [t("a", "2026-10-02", [p("S1", 1000, 1, "Anju"), p("S2", 500, 2)]), t("b", "2026-10-09", [p("S1", 200, 2, "Anjali N"), p("S2", 900, 1)])],
      opts,
    );
    expect(m.standings.map((r) => [r.name, r.points, r.played, r.wins])).toEqual([
      ["S2", 1400, 2, 1],
      ["Anjali N", 1200, 2, 1],
    ]);
    expect(JSON.stringify(m)).not.toContain('"S1"');
  });

  it("breaks ties on wins then best score, and honours the exclude toggle", () => {
    const m = computeMonth([t("a", "2026-10-02", [p("A", 500, 1), p("B", 500, 2)]), t("x", "2026-10-03", [p("B", 9999, 1)], false)], opts);
    expect(m.standings[0].name).toBe("A");
    expect(m.tournaments).toHaveLength(1);
  });

  it("supports F1-style rank points", () => {
    const m = computeMonth([t("a", "2026-10-02", [p("A", 50, 1), p("B", 4000, 2)])], { ...opts, method: "rankPoints" });
    expect(m.standings.map((r) => r.points)).toEqual([25, 18]);
  });

  it("buckets by month, newest first, and never exports Student IDs", () => {
    const file = buildMonthlyFile(
      [t("a", "2026-09-20", [p("IEAXEIT001", 10, 1, "Meera")]), t("b", "2026-10-05", [p("IEAXEIT001", 20, 1, "Meera")])],
      { ...opts, now: Date.UTC(2026, 9, 8, 11) },
    );
    expect(Object.keys(file.months)).toEqual(["2026-10", "2026-09"]);
    expect(file.updatedAt).toBe("2026-10-08T11:00:00.000Z");
    expect(JSON.stringify(file)).not.toContain("IEAXEIT001");
  });

  it("imports a backup without duplicating tournaments", () => {
    const a = t("a", "2026-10-02", [p("A", 1, 1)]);
    const b = t("b", "2026-10-03", [p("A", 1, 1)]);
    const { merged, added } = mergeHistory([a], [a, b]);
    expect(added).toBe(1);
    expect(merged.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
