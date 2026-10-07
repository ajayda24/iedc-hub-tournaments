import { z } from "zod";
import { createRng, type Rng } from "../../rng";
import { GAME_META } from "../meta";
import type { Difficulty, GameDefinition } from "../types";
import { candidates, conflicts, peers } from "./grid";

export { conflicts };

export interface SudokuPub {
  size: number;
  boxR: number;
  boxC: number;
  givens: number[]; // 0 = empty
}
export interface SudokuSecret {
  solution: number[];
}
export interface SudokuProgress {
  grid: number[];
}
export interface SudokuFeedback {
  wrongCount?: number;
}
export type SudokuSub = { grid: number[]; final: boolean };

interface Shape {
  size: number;
  boxR: number;
  boxC: number;
  /** how many givens we aim to leave (lower = harder); uniqueness always wins */
  givens: number;
}

const SHAPES: Record<Difficulty, Shape> = {
  easy: { size: 6, boxR: 2, boxC: 3, givens: 18 },
  med: { size: 6, boxR: 2, boxC: 3, givens: 12 },
  hard: { size: 9, boxR: 3, boxC: 3, givens: 30 },
};

/**
 * Backtracking solver with "fewest candidates first". Counts solutions up to
 * `limit` (2 is enough to prove uniqueness). Optionally randomises value order.
 */
export function countSolutions(
  start: number[],
  size: number,
  boxR: number,
  boxC: number,
  limit = 2,
  rng?: Rng,
  onSolution?: (g: number[]) => void,
): number {
  const grid = start.slice();
  const pr = peers(size, boxR, boxC);
  let count = 0;
  const solve = (): boolean => {
    let best = -1;
    let bestCands: number[] | null = null;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] !== 0) continue;
      const c = candidates(grid, i, size, pr);
      if (c.length === 0) return false;
      if (!bestCands || c.length < bestCands.length) {
        best = i;
        bestCands = c;
        if (c.length === 1) break;
      }
    }
    if (best === -1) {
      count++;
      onSolution?.(grid.slice());
      return count >= limit;
    }
    const order = rng ? rng.shuffle(bestCands!) : bestCands!;
    for (const v of order) {
      grid[best] = v;
      if (solve()) return true;
    }
    grid[best] = 0;
    return false;
  };
  solve();
  return count;
}

export function solveSudoku(givens: number[], size: number, boxR: number, boxC: number): number[] | null {
  let sol: number[] | null = null;
  countSolutions(givens, size, boxR, boxC, 1, undefined, (g) => (sol = g));
  return sol;
}

export function generateSudoku(seed: number, difficulty: Difficulty): { pub: SudokuPub; secret: SudokuSecret } {
  const rng = createRng(seed);
  const { size, boxR, boxC, givens: targetGivens } = SHAPES[difficulty];
  let solution: number[] = [];
  countSolutions(new Array(size * size).fill(0), size, boxR, boxC, 1, rng, (g) => (solution = g));

  const puzzle = solution.slice();
  let filled = puzzle.length;
  for (const i of rng.shuffle([...puzzle.keys()])) {
    if (filled <= targetGivens) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle, size, boxR, boxC, 2) !== 1) puzzle[i] = keep;
    else filled--;
  }
  return { pub: { size, boxR, boxC, givens: puzzle }, secret: { solution } };
}

export const sudoku: GameDefinition<SudokuPub, SudokuSecret, SudokuSub, SudokuProgress, SudokuFeedback> = {
  ...GAME_META.sudoku,
  subSchema: z.object({ grid: z.array(z.number().int().min(0).max(9)).max(81), final: z.boolean() }),
  generate: (seed, difficulty) => generateSudoku(seed, difficulty),
  initialProgress: (pub) => ({ grid: pub.givens.slice() }),
  check(pub, secret, progress, sub) {
    const n = pub.size * pub.size;
    if (sub.grid.length !== n || sub.grid.some((v) => v > pub.size)) {
      return { status: "invalid", progress, message: "That grid doesn't fit." };
    }
    // givens are not editable, whatever the client says
    const grid = sub.grid.map((v, i) => (pub.givens[i] ? pub.givens[i] : v));
    const next = { grid };
    if (!sub.final) return { status: "progress", progress: next };
    if (grid.some((v) => v === 0)) return { status: "invalid", progress: next, message: "Fill every cell first." };
    let wrong = 0;
    for (let i = 0; i < n; i++) if (grid[i] !== secret.solution[i]) wrong++;
    if (wrong === 0) return { status: "solved", progress: next };
    return {
      status: "wrong",
      progress: next,
      penalty: true,
      feedback: { wrongCount: wrong },
      message: wrong === 1 ? "One cell is lying to you." : `${wrong} cells are wrong.`,
    };
  },
  partialCredit(pub, secret, progress) {
    let empty = 0;
    let right = 0;
    for (let i = 0; i < pub.givens.length; i++) {
      if (pub.givens[i]) continue;
      empty++;
      if (progress.grid[i] === secret.solution[i]) right++;
    }
    return empty ? right / empty : 0;
  },
  reveal: (pub, secret) => ({
    kind: "grid",
    size: pub.size,
    boxR: pub.boxR,
    boxC: pub.boxC,
    grid: secret.solution,
    givens: pub.givens,
  }),
};
