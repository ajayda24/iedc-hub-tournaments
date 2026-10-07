import { describe, expect, it } from "vitest";
import { partialPoints, solvePoints } from "./scoring";

describe("scoring", () => {
  it("rewards speed, difficulty and first blood", () => {
    const fast = solvePoints({ difficulty: "easy", elapsedMs: 0, limitMs: 100_000, wrong: 0, first: true });
    expect(fast).toBe(1600);
    const slow = solvePoints({ difficulty: "easy", elapsedMs: 100_000, limitMs: 100_000, wrong: 0, first: false });
    expect(slow).toBe(1000);
    const hard = solvePoints({ difficulty: "hard", elapsedMs: 50_000, limitMs: 100_000, wrong: 2, first: false });
    expect(hard).toBe(2000 + 250 - 50);
  });
  it("partial credit is capped and never negative", () => {
    expect(partialPoints(1, 0)).toBe(300);
    expect(partialPoints(0.1, 5)).toBe(0);
  });
});
