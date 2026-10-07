import { z } from "zod";
import { createRng, type Rng } from "../../rng";
import { GAME_META } from "../meta";
import type { Difficulty, GameDefinition } from "../types";
import packsJson from "../../../content/anagram-packs.json";

export interface AnagramPack {
  id: string;
  title: string;
  words: string[];
  /** dictionary anagrams that are also accepted (e.g. notes → stone) */
  alts: Record<string, string[]>;
}
export const ANAGRAM_PACKS: readonly AnagramPack[] = packsJson as unknown as AnagramPack[];

export interface AnagramPub {
  packTitle: string;
  scrambles: string[];
}
export interface AnagramSecret {
  words: string[];
  accepted: string[][];
}
export interface AnagramProgress {
  /** solved answer per index, or null */
  answers: (string | null)[];
}
export interface AnagramFeedback {
  index?: number;
  correct?: boolean;
}
export type AnagramSub = { index: number; answer: string };

const LENGTHS: Record<Difficulty, [number, number]> = {
  easy: [3, 5],
  med: [5, 6],
  hard: [6, 8],
};
const COUNT: Record<Difficulty, number> = { easy: 6, med: 8, hard: 8 };

function scramble(word: string, avoid: Set<string>, rng: Rng): string {
  for (let tries = 0; tries < 30; tries++) {
    const s = rng.shuffle([...word]).join("");
    if (!avoid.has(s)) return s;
  }
  // tiny words with repeated letters: reverse is good enough
  return [...word].reverse().join("");
}

export function pickPack(options?: { pack?: string; customWords?: string[] }): AnagramPack {
  const custom = (options?.customWords ?? [])
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z]{3,10}$/.test(w));
  if (custom.length >= 3) return { id: "custom", title: "Host's Special", words: [...new Set(custom)], alts: {} };
  const found = ANAGRAM_PACKS.find((p) => p.id === options?.pack);
  if (found) return found;
  // "mixed": everything, titled accordingly
  return {
    id: "mixed",
    title: "Mixed Bag",
    words: ANAGRAM_PACKS.flatMap((p) => p.words),
    alts: Object.assign({}, ...ANAGRAM_PACKS.map((p) => p.alts)),
  };
}

export const anagram: GameDefinition<AnagramPub, AnagramSecret, AnagramSub, AnagramProgress, AnagramFeedback> = {
  ...GAME_META.anagram,
  subSchema: z.object({ index: z.number().int().min(0).max(20), answer: z.string().max(16) }),
  generate(seed, difficulty, options) {
    const rng = createRng(seed);
    const pack = pickPack(options);
    const [min, max] = LENGTHS[difficulty];
    let pool = pack.words.filter((w) => w.length >= min && w.length <= max);
    if (pool.length < COUNT[difficulty]) pool = pack.words.slice();
    const words = rng.shuffle([...new Set(pool)]).slice(0, COUNT[difficulty]);
    const accepted = words.map((w) => [w, ...(pack.alts[w] ?? [])]);
    const scrambles = words.map((w, i) => scramble(w, new Set(accepted[i]), rng).toUpperCase());
    return { pub: { packTitle: pack.title, scrambles }, secret: { words, accepted } };
  },
  initialProgress: (pub) => ({ answers: pub.scrambles.map(() => null) }),
  check(pub, secret, progress, sub) {
    const i = sub.index;
    if (i >= pub.scrambles.length) return { status: "invalid", progress, message: "No such word." };
    if (progress.answers[i]) return { status: "invalid", progress, message: "Already solved." };
    const answer = sub.answer.trim().toLowerCase();
    if (!secret.accepted[i].includes(answer)) {
      const sameLetters = [...answer].sort().join("") === [...secret.words[i]].sort().join("");
      return {
        status: "wrong",
        progress,
        feedback: { index: i, correct: false },
        message: sameLetters ? "Right letters, wrong word." : "Nope.",
      };
    }
    const answers = progress.answers.slice();
    answers[i] = answer;
    const next = { answers };
    const done = answers.every(Boolean);
    return { status: done ? "solved" : "progress", progress: next, feedback: { index: i, correct: true } };
  },
  partialCredit: (pub, _secret, progress) => progress.answers.filter(Boolean).length / pub.scrambles.length,
  reveal: (_pub, secret) => ({ kind: "words", words: secret.words }),
};
