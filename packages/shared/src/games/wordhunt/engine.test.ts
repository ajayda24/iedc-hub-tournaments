import { describe, expect, it } from "vitest";
import { isValidGuess, scoreGuess, wordhunt, WORDHUNT_ANSWERS } from "./engine";

describe("wordhunt", () => {
  it("colours repeated letters correctly", () => {
    expect(scoreGuess("speed", "abide")).toEqual(["x", "x", "y", "x", "y"]);
    expect(scoreGuess("eerie", "there")).toEqual(["y", "x", "y", "x", "g"]);
    expect(scoreGuess("crane", "crane")).toEqual(["g", "g", "g", "g", "g"]);
    expect(scoreGuess("lolly", "hello")).toEqual(["x", "y", "g", "g", "x"]);
  });

  it("every answer is a valid guess", () => {
    for (const w of WORDHUNT_ANSWERS) expect(isValidGuess(w)).toBe(true);
    expect(WORDHUNT_ANSWERS.length).toBeGreaterThan(400);
  });

  it("plays a round: invalid words are free, six misses fail", () => {
    const { pub, secret } = wordhunt.generate(5, "med");
    let p = wordhunt.initialProgress(pub);
    expect(wordhunt.check(pub, secret, p, { guess: "zzzzz" }).status).toBe("invalid");
    const misses = ["crane", "sloth", "pudgy", "wimpy", "fjord", "bumph", "glyph"].filter((w) => w !== secret.word && isValidGuess(w));
    for (let i = 0; i < 6; i++) {
      const r = wordhunt.check(pub, secret, p, { guess: misses[i] });
      p = r.progress;
      expect(r.status).toBe(i === 5 ? "failed" : "progress");
    }
  });

  it("solving early scores better quality", () => {
    const { pub, secret } = wordhunt.generate(11, "easy");
    const r = wordhunt.check(pub, secret, wordhunt.initialProgress(pub), { guess: secret.word });
    expect(r.status).toBe("solved");
    expect(r.quality).toBe(1);
  });
});
