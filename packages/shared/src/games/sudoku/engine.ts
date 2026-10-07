import { z } from "zod";
import { createRng, type Rng } from "../../rng";
import type { Difficulty, GameDefinition } from "../types";

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

/** Precomputed peer lists (row, column, box) per cell for a given shape. */
const peerCache = new Map<string, number[][]>();
function peers(size: number, boxR: number, boxC: number): number[][] {
  const key = `${size}:${boxR}:${boxC}`;
  const hit = peerCache.get(key);
  if (hit) return hit;
  const out: number[][] = [];
  for (let i = 0; i < size * size; i++) {
    const r = Math.floor(i / size);
    const c = i % size;
    const br = Math.floor(r / boxR) * boxR;
    const bc = Math.floor(c / boxC) * boxC;
    const set = new Set<number>();
    for (let k = 0; k < size; k++) {
      set.add(r * size + k);
      set.add(k * size + c);
    }
    for (let rr = br; rr < br + boxR; rr++) for (let cc = bc; cc < bc + boxC; cc++) set.add(rr * size + cc);
    set.delete(i);
    out.push([...set]);
  }
  peerCache.set(key, out);
  return out;
}

function candidates(grid: number[], i: number, size: number, pr: number[][]): number[] {
  let used = 0;
  for (const p of pr[i]) used |= 1 << grid[p];
  const out: number[] = [];
  for (let v = 1; v <= size; v++) if (!(used & (1 << v))) out.push(v);
  return out;
}

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

/** Cells that clash with another cell in their row/column/box. Safe to run on the client. */
export function conflicts(grid: number[], size: number, boxR: number, boxC: number): Set<number> {
  const pr = peers(size, boxR, boxC);
  const out = new Set<number>();
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i]) continue;
    for (const p of pr[i]) if (grid[p] === grid[i]) out.add(i);
  }
  return out;
}

export const sudoku: GameDefinition<SudokuPub, SudokuSecret, SudokuSub, SudokuProgress, SudokuFeedback> = {
  id: "sudoku",
  title: "Mini Sudoku",
  tagline: "Numbers. Boxes. Zero chill.",
  howTo: "Fill every row, column and box with each number exactly once. A full grid is checked automatically — wrong checks cost 25 points.",
  color: "mint",
  defaultTimeSec: { easy: 150, med: 210, hard: 420 },
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
