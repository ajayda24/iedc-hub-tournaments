import type { z } from "zod";

export type Difficulty = "easy" | "med" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "med", "hard"];

export type GameId = "sudoku" | "wordhunt" | "anagram" | "numbercrunch";
export type GameColor = "yellow" | "mint" | "coral" | "sky";

/**
 * Result of checking one submission.
 * - solved:   the puzzle is done, full points
 * - progress: accepted, keep going (autosave, a correct anagram, a closer number…)
 * - wrong:    a real wrong attempt (may cost points if `penalty`)
 * - invalid:  not a legal move (not a word, bad expression); never penalised
 * - failed:   out of attempts; the player is done and gets partial credit
 */
export type CheckStatus = "solved" | "progress" | "wrong" | "invalid" | "failed";

export interface CheckResult<Prog, Fb = unknown> {
  status: CheckStatus;
  progress: Prog;
  feedback?: Fb;
  penalty?: boolean;
  /** 0..1 multiplier on the base solve points (e.g. Wordle guesses used). Defaults to 1. */
  quality?: number;
  message?: string;
}

export interface Generated<Pub, Secret> {
  pub: Pub;
  secret: Secret;
}

export interface RoundOptions {
  /** anagram: which word pack to draw from */
  pack?: string;
  /** anagram: custom words typed by the host */
  customWords?: string[];
}

/**
 * Every game plugs into the arena through this contract. Engines are pure and
 * deterministic: the server generates from a seed, keeps `secret` to itself and
 * only ever sends `pub`, `progress` and `feedback` to players.
 */
export interface GameDefinition<Pub = any, Secret = any, Sub = any, Prog = any, Fb = any> {
  id: GameId;
  title: string;
  tagline: string;
  howTo: string;
  color: GameColor;
  defaultTimeSec: Record<Difficulty, number>;
  subSchema: z.ZodType<Sub>;
  generate(seed: number, difficulty: Difficulty, options?: RoundOptions): Generated<Pub, Secret>;
  initialProgress(pub: Pub): Prog;
  check(pub: Pub, secret: Secret, progress: Prog, sub: Sub): CheckResult<Prog, Fb>;
  /** 0..1 share of the puzzle done when time runs out (or attempts run out) */
  partialCredit(pub: Pub, secret: Secret, progress: Prog): number;
  /** Human readable answer shown after the round. */
  reveal(pub: Pub, secret: Secret): Reveal;
}

export type Reveal =
  | { kind: "grid"; size: number; boxR: number; boxC: number; grid: number[]; givens: number[] }
  | { kind: "words"; words: string[] }
  | { kind: "expression"; target: number; expression: string };
