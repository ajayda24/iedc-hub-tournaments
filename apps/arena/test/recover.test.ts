import { describe, expect, it } from "vitest";
import { anonKey, buildMonthlyFile, mergeHistory, type HistoryTournament } from "@iedc/shared";
import { recoverTournament } from "../src/recover";

const opts = { method: "points" as const, rankPoints: [25, 18, 15], monthsShown: 12 };
const date = new Date(2026, 9, 9, 13, 0).getTime();
const first: HistoryTournament = {
  id: "t1",
  name: "Weekly Series",
  date,
  month: "2026-10",
  included: true,
  players: [
    { studentId: "MEA23CS001", name: "Sneha P", dept: "EC", sem: "S3", score: 3526, rank: 1, solves: 4 },
    { studentId: "MEA23CS002", name: "Arun K", dept: "CSE", sem: "S3", score: 2981, rank: 2, solves: 3 },
    { studentId: "MEA23CS003", name: "Zero Hero", dept: "ME", sem: "S5", score: 0, rank: 3, solves: 0 },
  ],
};

describe("recoverTournament", () => {
  const published = buildMonthlyFile([first], opts);

  it("rebuilds the lost tournament and matches students who came back", () => {
    // only Sneha joined again on this laptop
    const { tournament, matched, unmatched } = recoverTournament(published, "2026-10", ["MEA23CS001", "OTHER9"]);
    expect(matched).toBe(1);
    expect(unmatched).toBe(2);
    expect(tournament.players[0]).toMatchObject({ studentId: "MEA23CS001", name: "Sneha P", score: 3526, rank: 1 });
    expect(tournament.players[1].studentId).toBe(`recovered:${anonKey("MEA23CS002")}`);
    expect(tournament.month).toBe("2026-10");
  });

  it("gives the same standings as before, and adds up with the next tournament", () => {
    const { tournament } = recoverTournament(published, "2026-10", ["MEA23CS001"]);
    const again = buildMonthlyFile([tournament], opts).months["2026-10"];
    expect(again.standings.map((r) => [r.name, r.points])).toEqual(published.months["2026-10"].standings.map((r) => [r.name, r.points]));

    const second: HistoryTournament = {
      ...first,
      id: "t2",
      date: date + 7 * 864e5,
      players: [{ studentId: "MEA23CS001", name: "Sneha P", dept: "EC", sem: "S3", score: 1000, rank: 1, solves: 4 }],
    };
    const { merged } = mergeHistory([second], [tournament]);
    const month = buildMonthlyFile(merged, opts).months["2026-10"];
    expect(month.tournaments).toHaveLength(2);
    expect(month.standings[0]).toMatchObject({ name: "Sneha P", points: 4526, played: 2, wins: 2 });
    expect(month.standings.find((r) => r.name === "Arun K")?.points).toBe(2981);
  });

  it("importing twice doesn't double count", () => {
    const { tournament } = recoverTournament(published, "2026-10", []);
    const once = mergeHistory([], [tournament]).merged;
    expect(mergeHistory(once, [tournament]).added).toBe(0);
  });

  it("refuses a month with several tournaments", () => {
    const two = buildMonthlyFile([first, { ...first, id: "t2", date: date + 1000 }], opts);
    expect(() => recoverTournament(two, "2026-10", [])).toThrow(/exactly one/);
  });
});
