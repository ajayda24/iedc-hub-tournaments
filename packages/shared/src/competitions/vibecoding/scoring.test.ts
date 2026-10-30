import { describe, expect, it } from "vitest";
import { awards, badges, efficiencyPoints, puzzleTimePoints, rankBonus, rankTeams, speedPoints, teamScore, tileScore } from "./scoring";
import { createTeamState, sizeFactor, applyAction } from "./rules";
import { createState, type CompetitionState, type Team } from "./state";
import { TILE_IDS } from "./config";

const MIN = 60_000;
const T0 = Date.UTC(2026, 11, 1, 5, 0, 0);
const member = (id: string) => ({ studentId: id, name: id, dept: "CSE", sem: "S3", avatar: 1, joinedAt: 0, ready: true });
const check = (passed: number, total: number) => ({ items: {}, passed, total, at: 0 });

function team(id: string, size = 3): Team {
  const t = createTeamState(id.length * 7 + 1, { id, name: `Team ${id}`, code: "ABCD", captain: `${id}1`, createdAt: 0 });
  t.members = Array.from({ length: size }, (_, i) => member(`${id}${i + 1}`));
  return t;
}
function state(teams: Team[]): CompetitionState {
  const s = createState(1, T0);
  for (const t of teams) {
    s.teams[t.id] = t;
    s.teamOrder.push(t.id);
  }
  return s;
}
/** A tile done in `minutes` with `asks` Asks. */
function done(t: Team, id: (typeof TILE_IDS)[number], minutes: number, asks: number, extra: Partial<Team["tiles"]["hero"]> = {}) {
  Object.assign(t.tiles[id], { firstOpenedAt: 0, doneAt: minutes * MIN, asks, asksToPass: asks, ...extra });
}

describe("tile points (spec 10.1)", () => {
  it.each([
    [3, 6, 50],
    [6, 6, 50],
    [9, 6, 25],
    [12, 6, 0],
    [20, 6, 0],
    [0, 10, 50],
    [15, 10, 25],
  ])("speed: %i min on par %i → %i", (t, p, pts) => expect(speedPoints(t, p)).toBe(pts));

  it.each([
    [0, 50],
    [3, 50],
    [4, 30],
    [5, 15],
    [6, 0],
    [12, 0],
  ])("efficiency: %i Asks → %i", (a, pts) => expect(efficiencyPoints(a)).toBe(pts));

  it("done tile: base + speed + efficiency + Save Point − hints, never below 0", () => {
    const t = team("a");
    done(t, "hero", 6, 2, { savedBeforePass: true, hints: 1 });
    expect(tileScore(t, "hero").points).toBe(100 + 50 + 50 + 10 - 10);
    done(t, "countdown", 30, 9, { hints: 5 });
    expect(tileScore(t, "countdown").points).toBe(100 - 30);
  });

  it("Show me = 50 flat; host unlock = base only; unfinished = partial", () => {
    const t = team("a");
    done(t, "hero", 1, 1, { autoSolved: true, hints: 3, savedBeforePass: true });
    expect(tileScore(t, "hero").points).toBe(50);
    done(t, "gallery", 1, 1, { hostUnlocked: true });
    expect(tileScore(t, "gallery").points).toBe(100);
    t.tiles.register.lastCheck = check(3, 4);
    expect(tileScore(t, "register").points).toBe(37);
    expect(tileScore(t, "schedule").points).toBe(0);
  });
});

describe("team points (spec 10.2)", () => {
  it("notes, clean rewind, puzzle (time + moves), publish + rank, change request windows", () => {
    const t = team("a");
    t.notesBonus = true;
    t.cleanRewind = true;
    t.puzzle = { board: [1, 2, 3, 4, 5, 6, 7, 8, 0], optimal: 10, moves: 10, startedAt: 40 * MIN, solvedAt: 40 * MIN + 110_000, version: 0 };
    t.publish = { firstAt: 50 * MIN, adjustedAt: 50 * MIN, lastAt: 50 * MIN, count: 1, slug: "a" };
    t.changeRequest = { variant: "A", sentAt: 50 * MIN, doneAt: 59 * MIN };
    const s = state([t]);
    const lines = Object.fromEntries(teamScore(s, t).team.map((l) => [l.label, l.points]));
    expect(lines).toEqual({
      "Project Notes": 60,
      "Clean Rewind": 20,
      "Puzzle solved": 300,
      "Puzzle speed": puzzleTimePoints(110, 10),
      "Puzzle moves": 100,
      Published: 200,
      "Publish rank #1": 100,
      "Change request": 100,
    });
    expect(puzzleTimePoints(110, 10)).toBe(150); // Q = 110 s, at Q → full
    expect(puzzleTimePoints(165, 10)).toBe(75);
    expect(puzzleTimePoints(220, 10)).toBe(0);
    t.changeRequest.doneAt = 50 * MIN + 15 * MIN;
    expect(teamScore(s, t).team.find((l) => l.label === "Change request")!.points).toBe(50);
    t.changeRequest.doneAt = 50 * MIN + 25 * MIN;
    expect(teamScore(s, t).team.find((l) => l.label === "Change request")).toBeUndefined();
  });

  it("puzzle moves bonus and partial puzzle credit at freeze", () => {
    const t = team("a");
    t.puzzle = { board: [1, 2, 3, 4, 5, 6, 7, 8, 0], optimal: 10, moves: 20, startedAt: 0, solvedAt: 1000, version: 0 };
    expect(teamScore(state([t]), t).team.find((l) => l.label === "Puzzle moves")!.points).toBe(50);
    t.puzzle = { board: [1, 2, 3, 4, 5, 6, 0, 7, 8], optimal: 2, moves: 0, startedAt: 0, solvedAt: null, version: 0 };
    expect(teamScore(state([t]), t).team.find((l) => l.label === "Puzzle (partial)")!.points).toBe(75);
  });

  it.each([
    [1, 100],
    [2, 80],
    [3, 60],
    [4, 40],
    [6, 40],
    [7, 20],
    [15, 20],
  ])("publish rank %i → +%i", (r, pts) => expect(rankBonus(r)).toBe(pts));

  it("size factor (10.6): 2 → 0.85, 3 → 1, 4 → 1.15; ranks use the adjusted time", () => {
    expect([sizeFactor(2), sizeFactor(3), sizeFactor(4)]).toEqual([0.85, 1, 1.15]);
    const small = team("s", 2);
    const big = team("b", 4);
    // the big team published first in raw time, but the small team wins on adjusted time
    small.publish = { firstAt: 60 * MIN, adjustedAt: Math.round(60 * MIN * 0.85), lastAt: 0, count: 1, slug: "s" };
    big.publish = { firstAt: 55 * MIN, adjustedAt: Math.round(55 * MIN * 1.15), lastAt: 0, count: 1, slug: "b" };
    const s = state([big, small]);
    expect(teamScore(s, small).team.find((l) => l.label.startsWith("Publish rank"))!.label).toBe("Publish rank #1");
    expect(teamScore(s, big).team.find((l) => l.label.startsWith("Publish rank"))!.label).toBe("Publish rank #2");
  });

  it("the size factor is applied when a team publishes", () => {
    const s = createState(3, T0);
    const go = (a: Parameters<typeof applyAction>[1], now = T0) => applyAction(s, a, { now });
    go({ type: "phase:set", phase: "registration" });
    for (const id of ["A1", "A2"]) go({ type: "person:join", person: { studentId: id, name: id, dept: "x", sem: "y", avatar: 0 } });
    const id = go({ type: "team:create", studentId: "A1", name: "Duo" }).teamId!;
    go({ type: "team:join", studentId: "A2", code: s.teams[id].code });
    go({ type: "phase:set", phase: "build" });
    go({ type: "publish:result", teamId: id, changePassed: false, slug: "duo" }, T0 + 40 * MIN);
    expect(s.teams[id].publish!.firstAt).toBe(40 * MIN);
    expect(s.teams[id].publish!.adjustedAt).toBe(34 * MIN);
  });
});

describe("tie-breaks (10.3), badges (10.4), awards (10.5)", () => {
  it("ties: adjusted publish time, then fewer Asks, then earlier puzzle solve", () => {
    const [a, b, c, d] = ["a", "b", "c", "d"].map((x) => team(x));
    // equal scores everywhere (no tiles); only tie-breaks differ
    a.asksUsed = 5;
    b.asksUsed = 3;
    c.asksUsed = 3;
    c.puzzle = { board: [0, 1, 2, 3, 4, 5, 6, 7, 8], optimal: 20, moves: 0, startedAt: 0, solvedAt: null, version: 0 };
    d.asksUsed = 3;
    const s = state([a, b, c, d]);
    // c's puzzle has no pieces in place (0 points), so all four are on 0 points: fewer Asks first, then the original order
    expect(rankTeams(s).map((r) => r.teamId)).toEqual(["b", "c", "d", "a"]);
    // same score, same Asks: the earlier puzzle solve wins
    c.puzzle.solvedAt = 5 * MIN;
    d.puzzle = { ...c.puzzle, startedAt: -MIN, solvedAt: 4 * MIN }; // same 5-minute solve, finished earlier
    c.puzzle.board = d.puzzle.board = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const scoreOf = (t: Team) => teamScore(s, t).total;
    expect(scoreOf(c)).toBe(scoreOf(d));
    expect(rankTeams(s).map((r) => r.teamId).indexOf("d")).toBeLessThan(rankTeams(s).map((r) => r.teamId).indexOf("c"));
  });

  it("badges", () => {
    const t = team("a");
    const s = state([t, team("b")]);
    s.firstTileBy = "a";
    done(t, "hero", 2, 1);
    for (const id of TILE_IDS.slice(0, 6)) t.tiles[id].saves.push({ id: "s1", kind: "save", label: "x", at: 0, fragment: { html: "", css: "", js: "" } });
    t.cleanRewind = true;
    t.notesBonus = true;
    t.puzzle = { board: [], optimal: 10, moves: 12, startedAt: 0, solvedAt: 5, version: 0 };
    t.publish = { firstAt: 10, adjustedAt: 10, lastAt: 10, count: 1, slug: "a" };
    t.changeRequest = { variant: "A", sentAt: 10, doneAt: 10 + 5 * MIN };
    expect(badges(s, t)).toEqual(["First Blood", "Quick Draw", "Save Hero", "Clean Rewind", "Notes Ninja", "Puzzle Pro", "Zero Hints", "First to Publish", "Client Pleaser"]);
    t.puzzle.moves = 13;
    t.tiles.hero.hints = 1;
    expect(badges(s, t)).not.toContain("Puzzle Pro");
    expect(badges(s, t)).not.toContain("Zero Hints");
  });

  it("awards: champion, fastest (adjusted), fastest small team, cleanest asks, best-looking, comeback", () => {
    const a = team("a", 4);
    const b = team("b", 2);
    const c = team("c", 3);
    done(a, "hero", 3, 1);
    done(a, "gallery", 3, 1);
    a.publish = { firstAt: 50 * MIN, adjustedAt: 57.5 * MIN, lastAt: 0, count: 1, slug: "a" };
    a.asksUsed = 30;
    b.publish = { firstAt: 60 * MIN, adjustedAt: 51 * MIN, lastAt: 0, count: 1, slug: "b" };
    b.asksUsed = 12;
    const s = state([a, b, c]);
    s.votes = { X1: "b", X2: "b", X3: "a" };
    s.standingsAt60 = ["c", "b", "a"];
    const byId = Object.fromEntries(awards(s).map((x) => [x.id, x.teamId]));
    expect(byId).toEqual({ champion: "a", fastest: "b", small: "b", clean: "b", looks: "b", comeback: "a" });
  });
});
