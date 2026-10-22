import { describe, expect, it } from "vitest";
import { countQueens, generateQueens, queenConflicts, queens } from "./engine";

describe("queens", () => {
  it("counts the textbook number of solutions", () => {
    expect(countQueens(6, [], [], 100)).toBe(4);
    expect(countQueens(8, [], [], 100)).toBe(92);
  });

  for (const d of ["easy", "med", "hard"] as const) {
    it(`${d}: generates a puzzle with exactly one completion`, () => {
      for (let seed = 1; seed <= 8; seed++) {
        const { pub, secret } = generateQueens(seed * 7919, d);
        expect(countQueens(pub.size, pub.givens, pub.blocked, 2)).toBe(1);
        expect(secret.solution).toHaveLength(pub.size);
        expect(queenConflicts(secret.solution, pub.size).size).toBe(0);
        pub.givens.forEach((g) => expect(secret.solution).toContain(g));
        pub.blocked.forEach((b) => expect(secret.solution).not.toContain(b));
      }
    });
  }

  it("is deterministic per seed", () => {
    expect(generateQueens(42, "med")).toEqual(generateQueens(42, "med"));
  });

  it("checks a final board, keeps givens and ignores blocked cells", () => {
    const { pub, secret } = queens.generate(9, "med");
    const progress = queens.initialProgress(pub);
    expect(queens.check(pub, secret, progress, { queens: secret.solution, final: true }).status).toBe("solved");

    const short = queens.check(pub, secret, progress, { queens: secret.solution.slice(1), final: true });
    expect(short.status === "invalid" || short.status === "wrong").toBe(true);

    // shift one non-given queen sideways onto a free cell: a clash
    const free = secret.solution.find((q) => !pub.givens.includes(q))!;
    const moved = [...pub.givens, ...secret.solution.filter((q) => q !== free && !pub.givens.includes(q))];
    const row = Math.floor(free / pub.size);
    const alt = Array.from({ length: pub.size }, (_, c) => row * pub.size + c).find((c) => c !== free && !pub.blocked.includes(c))!;
    const bad = queens.check(pub, secret, progress, { queens: [...moved, alt], final: true });
    expect(bad.status).toBe("wrong");
    expect(bad.penalty).toBe(true);

    const t = queens.check(pub, secret, progress, { queens: [...pub.blocked], final: false });
    expect(t.progress.queens).toEqual(pub.givens);
  });

  it("gives partial credit only for net-correct queens", () => {
    const { pub, secret } = queens.generate(3, "easy");
    expect(queens.partialCredit(pub, secret, { queens: pub.givens })).toBe(0);
    expect(queens.partialCredit(pub, secret, { queens: secret.solution })).toBe(1);
    const everything = Array.from({ length: pub.size * pub.size }, (_, i) => i);
    expect(queens.partialCredit(pub, secret, { queens: everything })).toBe(0);
  });
});
