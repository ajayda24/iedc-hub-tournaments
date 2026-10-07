import { describe, expect, it } from "vitest";
import { evaluateExpression, generateCrunch, numbercrunch, solveCrunch } from "./engine";

describe("numbercrunch", () => {
  for (const d of ["easy", "med", "hard"] as const) {
    it(`${d}: every target is reachable with its own stored solution`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        const { pub, secret } = generateCrunch(seed * 104729, d);
        expect(evaluateExpression(secret.expression, pub.numbers)).toBe(pub.target);
      }
    });
  }

  it("enforces the rules", () => {
    expect(() => evaluateExpression("5 - 7", [5, 7])).toThrow(/negatives/);
    expect(() => evaluateExpression("7 / 2", [7, 2])).toThrow(/whole/);
    expect(() => evaluateExpression("5 + 5", [5, 3])).toThrow(/spare 5/);
    expect(() => evaluateExpression("alert(1)", [1])).toThrow();
    expect(evaluateExpression("(100 + 4) × 3", [100, 4, 3])).toBe(312);
  });

  it("the brute-force solver finds generated targets", () => {
    const { pub } = generateCrunch(77, "med");
    const best = solveCrunch(pub.numbers, pub.target);
    expect(best.value).toBe(pub.target);
    expect(evaluateExpression(best.expr, pub.numbers)).toBe(pub.target);
  });

  it("tracks the closest attempt for partial credit", () => {
    const pub = { numbers: [100, 4, 3], target: 312 };
    const secret = { expression: "(100 + 4) × 3" };
    let p = numbercrunch.initialProgress(pub);
    const r = numbercrunch.check(pub, secret, p, { expr: "100 × 3" });
    expect(r.status).toBe("wrong");
    p = r.progress;
    expect(numbercrunch.partialCredit(pub, secret, p)).toBe(0);
    p = numbercrunch.check(pub, secret, p, { expr: "100 × 3 + 4" }).progress;
    expect(numbercrunch.partialCredit(pub, secret, p)).toBeCloseTo(1 - 8 / 11);
    expect(numbercrunch.check(pub, secret, p, { expr: "(100+4)*3" }).status).toBe("solved");
  });
});
