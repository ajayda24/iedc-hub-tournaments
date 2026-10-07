import { describe, expect, it } from "vitest";
import { conflicts, countSolutions, generateSudoku, sudoku } from "./engine";

describe("sudoku", () => {
  for (const d of ["easy", "med", "hard"] as const) {
    it(`${d}: generates a puzzle with exactly one solution`, () => {
      for (let seed = 1; seed <= 5; seed++) {
        const { pub, secret } = generateSudoku(seed * 7919, d);
        expect(countSolutions(pub.givens, pub.size, pub.boxR, pub.boxC, 2)).toBe(1);
        expect(conflicts(secret.solution, pub.size, pub.boxR, pub.boxC).size).toBe(0);
        pub.givens.forEach((v, i) => v && expect(secret.solution[i]).toBe(v));
      }
    });
  }

  it("is deterministic per seed", () => {
    expect(generateSudoku(42, "med")).toEqual(generateSudoku(42, "med"));
  });

  it("checks a final grid and refuses to let givens be overwritten", () => {
    const { pub, secret } = sudoku.generate(9, "easy");
    const progress = sudoku.initialProgress(pub);
    const solved = sudoku.check(pub, secret, progress, { grid: secret.solution, final: true });
    expect(solved.status).toBe("solved");

    const wrong = secret.solution.slice();
    const free = pub.givens.findIndex((v) => v === 0);
    wrong[free] = (wrong[free] % pub.size) + 1;
    const bad = sudoku.check(pub, secret, progress, { grid: wrong, final: true });
    expect(bad.status).toBe("wrong");
    expect(bad.penalty).toBe(true);

    const tampered = secret.solution.map(() => 1);
    const t = sudoku.check(pub, secret, progress, { grid: tampered, final: false });
    pub.givens.forEach((v, i) => v && expect((t.progress.grid as number[])[i]).toBe(v));
  });

  it("gives partial credit for correctly filled cells", () => {
    const { pub, secret } = sudoku.generate(3, "easy");
    expect(sudoku.partialCredit(pub, secret, { grid: pub.givens })).toBe(0);
    expect(sudoku.partialCredit(pub, secret, { grid: secret.solution })).toBe(1);
  });
});
