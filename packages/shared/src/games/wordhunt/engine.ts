import { z } from "zod";
import { createRng } from "../../rng";
import { GAME_META } from "../meta";
import type { GameDefinition } from "../types";
import answersJson from "../../../content/wordhunt-answers.json";
import words5Json from "../../../content/words5.json";

/** g = right spot, y = in the word, x = nope */
export type Tile = "g" | "y" | "x";

export interface WordHuntPub {
  length: number;
  maxGuesses: number;
}
export interface WordHuntSecret {
  word: string;
}
export interface WordHuntGuess {
  word: string;
  tiles: Tile[];
}
export interface WordHuntProgress {
  guesses: WordHuntGuess[];
}
export interface WordHuntFeedback {
  tiles?: Tile[];
}
export type WordHuntSub = { guess: string };

export const WORDHUNT_ANSWERS: readonly string[] = answersJson as string[];
let validSet: Set<string> | null = null;
export function isValidGuess(word: string): boolean {
  if (!validSet) validSet = new Set((words5Json as string).split(" "));
  return validSet.has(word);
}

/** Wordle colouring with correct handling of repeated letters. */
export function scoreGuess(guess: string, answer: string): Tile[] {
  const tiles: Tile[] = new Array(guess.length).fill("x");
  const left = new Map<string, number>();
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) tiles[i] = "g";
    else left.set(answer[i], (left.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < guess.length; i++) {
    if (tiles[i] === "g") continue;
    const n = left.get(guess[i]) ?? 0;
    if (n > 0) {
      tiles[i] = "y";
      left.set(guess[i], n - 1);
    }
  }
  return tiles;
}

const MAX_GUESSES = 6;

export const wordhunt: GameDefinition<WordHuntPub, WordHuntSecret, WordHuntSub, WordHuntProgress, WordHuntFeedback> = {
  ...GAME_META.wordhunt,
  subSchema: z.object({ guess: z.string().min(1).max(12) }),
  generate(seed) {
    const rng = createRng(seed);
    return { pub: { length: 5, maxGuesses: MAX_GUESSES }, secret: { word: rng.pick(WORDHUNT_ANSWERS) } };
  },
  initialProgress: () => ({ guesses: [] }),
  check(pub, secret, progress, sub) {
    const guess = sub.guess.trim().toLowerCase();
    if (progress.guesses.length >= pub.maxGuesses) return { status: "failed", progress };
    if (!/^[a-z]+$/.test(guess) || guess.length !== pub.length) {
      return { status: "invalid", progress, message: `Needs ${pub.length} letters.` };
    }
    if (!isValidGuess(guess)) return { status: "invalid", progress, message: "Not in our dictionary. Nice try." };
    if (progress.guesses.some((g) => g.word === guess)) {
      return { status: "invalid", progress, message: "You already tried that one." };
    }
    const tiles = scoreGuess(guess, secret.word);
    const next = { guesses: [...progress.guesses, { word: guess, tiles }] };
    if (guess === secret.word) {
      // 1 guess = 100%, 6 guesses = 60%
      return { status: "solved", progress: next, feedback: { tiles }, quality: 1 - 0.08 * (next.guesses.length - 1) };
    }
    if (next.guesses.length >= pub.maxGuesses) return { status: "failed", progress: next, feedback: { tiles } };
    return { status: "progress", progress: next, feedback: { tiles } };
  },
  partialCredit(pub, _secret, progress) {
    let best = 0;
    for (const g of progress.guesses) {
      const v = g.tiles.reduce((s, t) => s + (t === "g" ? 1 : t === "y" ? 0.4 : 0), 0) / pub.length;
      best = Math.max(best, v);
    }
    return best * 0.8;
  },
  reveal: (_pub, secret) => ({ kind: "words", words: [secret.word] }),
};
