import type { Difficulty } from "./games/types";

export const DIFF_MULT: Record<Difficulty, number> = { easy: 1, med: 1.5, hard: 2 };

export const SCORING = {
  base: 1000,
  speedMax: 500,
  firstBlood: 100,
  wrongPenalty: 25,
  partialMax: 300,
  strikePenalty: 200,
  minSolve: 100,
} as const;

export interface SolveInput {
  difficulty: Difficulty;
  elapsedMs: number;
  limitMs: number;
  wrong: number;
  first: boolean;
  quality?: number;
}

/** Points for solving: base × difficulty × quality + speed bonus + first blood − wrong checks. */
export function solvePoints({ difficulty, elapsedMs, limitMs, wrong, first, quality = 1 }: SolveInput): number {
  const base = SCORING.base * DIFF_MULT[difficulty] * quality;
  const speed = SCORING.speedMax * Math.max(0, 1 - elapsedMs / limitMs);
  const total = base + speed + (first ? SCORING.firstBlood : 0) - SCORING.wrongPenalty * wrong;
  return Math.max(SCORING.minSolve, Math.round(total));
}

/** Points for an unfinished puzzle when time (or attempts) run out. */
export function partialPoints(fraction: number, wrong: number): number {
  const f = Math.min(1, Math.max(0, fraction));
  return Math.max(0, Math.round(SCORING.partialMax * f - SCORING.wrongPenalty * wrong));
}
