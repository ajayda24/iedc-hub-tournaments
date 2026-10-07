import { describe, expect, it } from "vitest";
import { anagram, ANAGRAM_PACKS } from "./engine";

describe("anagram", () => {
  it("scrambles never show the answer", () => {
    for (let seed = 1; seed < 40; seed++) {
      for (const d of ["easy", "med", "hard"] as const) {
        const { pub, secret } = anagram.generate(seed, d);
        pub.scrambles.forEach((s, i) => {
          expect(secret.accepted[i]).not.toContain(s.toLowerCase());
          expect([...s.toLowerCase()].sort().join("")).toBe([...secret.words[i]].sort().join(""));
        });
      }
    }
  });

  it("accepts dictionary alternates and finishes when all are solved", () => {
    const { pub, secret } = anagram.generate(7, "easy", { pack: "campus" });
    let p = anagram.initialProgress(pub);
    expect(anagram.check(pub, secret, p, { index: 0, answer: "qqq" }).status).toBe("wrong");
    secret.words.forEach((w, i) => {
      const r = anagram.check(pub, secret, p, { index: i, answer: secret.accepted[i].at(-1)! });
      p = r.progress;
      expect(r.status).toBe(i === secret.words.length - 1 ? "solved" : "progress");
    });
  });

  it("uses custom host words when given", () => {
    const { pub } = anagram.generate(1, "easy", { customWords: ["iedc", "kochi", "hackathon"] });
    expect(pub.packTitle).toBe("Host's Special");
    expect(ANAGRAM_PACKS.length).toBeGreaterThanOrEqual(4);
  });
});
