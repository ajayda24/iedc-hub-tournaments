import { z } from "zod";
import { createRng } from "../../rng";
import { GAME_META } from "../meta";
import type { Difficulty, GameDefinition } from "../types";
import { gameText } from "@iedc/data/copy/games";

/**
 * Classic N-Queens (rows, columns, full diagonals) made seedable: a few queens
 * are pre-placed and some cells are blocked so that exactly one completion
 * exists. Memorising "the" 8-queens answer doesn't help — every round differs.
 */
export interface QueensPub {
  size: number;
  /** cell indices (row * size + col) of the pre-placed queens */
  givens: number[];
  /** cell indices where no queen may go */
  blocked: number[];
}
export interface QueensSecret {
  /** cell indices of all queens in the unique solution, one per row, row order */
  solution: number[];
}
export interface QueensProgress {
  queens: number[];
}
export type QueensSub = { queens: number[]; final: boolean };

interface Shape {
  size: number;
  givens: number;
  /** blocked cells added on top of the minimum needed for uniqueness (more = easier) */
  extraBlocks: number;
}

const SHAPES: Record<Difficulty, Shape> = {
  easy: { size: 6, givens: 1, extraBlocks: 6 },
  med: { size: 8, givens: 1, extraBlocks: 3 },
  hard: { size: 10, givens: 1, extraBlocks: 0 },
};

/** Cells under attack: two queens sharing a row, column or diagonal. */
export function queenConflicts(queens: number[], size: number): Set<number> {
  const bad = new Set<number>();
  for (let a = 0; a < queens.length; a++) {
    for (let b = a + 1; b < queens.length; b++) {
      const ra = Math.floor(queens[a] / size), ca = queens[a] % size;
      const rb = Math.floor(queens[b] / size), cb = queens[b] % size;
      if (ra === rb || ca === cb || Math.abs(ra - rb) === Math.abs(ca - cb)) {
        bad.add(queens[a]);
        bad.add(queens[b]);
      }
    }
  }
  return bad;
}

/**
 * Bitmask backtracking over rows. Counts completions up to `limit` that keep
 * the given queens and avoid blocked cells. Optionally randomises column order.
 */
export function countQueens(
  size: number,
  givens: number[],
  blocked: number[],
  limit = 2,
  rng?: { shuffle<T>(a: readonly T[]): T[] },
  onSolution?: (cells: number[]) => void,
): number {
  const fixed = new Array<number>(size).fill(-1);
  for (const g of givens) fixed[Math.floor(g / size)] = g % size;
  const blockMask = new Array<number>(size).fill(0);
  for (const b of blocked) blockMask[Math.floor(b / size)] |= 1 << (b % size);
  const cols = Array.from({ length: size }, (_, c) => c);
  const placed: number[] = [];
  let count = 0;

  const solve = (r: number, colM: number, d1: number, d2: number): boolean => {
    if (r === size) {
      count++;
      onSolution?.(placed.map((c, row) => row * size + c));
      return count >= limit;
    }
    const order = fixed[r] >= 0 ? [fixed[r]] : rng ? rng.shuffle(cols) : cols;
    for (const c of order) {
      const a = r + c;
      const b = r - c + size - 1;
      if (colM & (1 << c) || d1 & (1 << a) || d2 & (1 << b) || blockMask[r] & (1 << c)) continue;
      placed[r] = c;
      if (solve(r + 1, colM | (1 << c), d1 | (1 << a), d2 | (1 << b))) return true;
    }
    return false;
  };
  solve(0, 0, 0, 0);
  return count;
}

export function generateQueens(seed: number, difficulty: Difficulty): { pub: QueensPub; secret: QueensSecret } {
  const rng = createRng(seed);
  const { size, givens: nGivens, extraBlocks } = SHAPES[difficulty];
  let solution: number[] = [];
  countQueens(size, [], [], 1, rng, (s) => (solution = s));

  const givens = rng.shuffle(solution).slice(0, nGivens).sort((a, b) => a - b);
  const inSolution = new Set(solution);
  const blocked = new Set<number>();

  // Block a queen cell of every rival solution until only ours is left.
  for (;;) {
    const rivals: number[][] = [];
    countQueens(size, givens, [...blocked], 2, rng, (s) => {
      if (s.some((cell) => !inSolution.has(cell))) rivals.push(s);
    });
    if (!rivals.length) break;
    blocked.add(rng.pick(rivals[0].filter((cell) => !inSolution.has(cell))));
  }

  // Drop blocks that turned out not to be needed (fewer blocks = more thinking).
  for (const b of rng.shuffle([...blocked])) {
    blocked.delete(b);
    if (countQueens(size, givens, [...blocked], 2) !== 1) blocked.add(b);
  }

  // Easier levels get a few free hints: extra blocked cells a queen could otherwise reach.
  const attacked = attackedBy(givens, size);
  const spare = rng.shuffle(
    Array.from({ length: size * size }, (_, i) => i).filter((i) => !inSolution.has(i) && !blocked.has(i) && !attacked.has(i)),
  );
  for (const cell of spare.slice(0, extraBlocks)) blocked.add(cell);

  return {
    pub: { size, givens, blocked: [...blocked].sort((a, b) => a - b) },
    secret: { solution },
  };
}

/** Every cell a set of queens attacks (or sits on). */
export function attackedBy(queens: number[], size: number): Set<number> {
  const out = new Set<number>();
  for (const q of queens) {
    const r = Math.floor(q / size), c = q % size;
    for (let i = 0; i < size * size; i++) {
      const ri = Math.floor(i / size), ci = i % size;
      if (ri === r || ci === c || Math.abs(ri - r) === Math.abs(ci - c)) out.add(i);
    }
  }
  return out;
}

/** Legal move set: unique cells on the board, givens always kept, never on a blocked cell. */
function clean(pub: QueensPub, queens: number[]): number[] {
  const n = pub.size * pub.size;
  const blocked = new Set(pub.blocked);
  const set = new Set(pub.givens);
  for (const q of queens) if (q >= 0 && q < n && !blocked.has(q)) set.add(q);
  return [...set].sort((a, b) => a - b);
}

export const queens: GameDefinition<QueensPub, QueensSecret, QueensSub, QueensProgress> = {
  ...GAME_META.queens,
  subSchema: z.object({ queens: z.array(z.number().int().min(0).max(143)).max(144), final: z.boolean() }),
  generate: (seed, difficulty) => generateQueens(seed, difficulty),
  initialProgress: (pub) => ({ queens: pub.givens.slice() }),
  check(pub, secret, progress, sub) {
    const next = { queens: clean(pub, sub.queens) };
    if (!sub.final) return { status: "progress", progress: next };
    if (next.queens.length !== pub.size) {
      return { status: "invalid", progress: next, message: gameText.queens.needQueens(pub.size) };
    }
    // the solution is unique, so any clash-free full board is that solution
    const clashes = queenConflicts(next.queens, pub.size).size;
    if (clashes === 0) return { status: "solved", progress: next };
    return { status: "wrong", progress: next, penalty: true, message: gameText.queens.clashing(clashes) };
  },
  partialCredit(pub, secret, progress) {
    const target = new Set(secret.solution);
    const given = new Set(pub.givens);
    const needed = pub.size - pub.givens.length;
    let right = 0;
    let wrong = 0;
    for (const q of progress.queens) {
      if (given.has(q)) continue;
      if (target.has(q)) right++;
      else wrong++;
    }
    // stray queens cancel right ones, so carpeting the board earns nothing
    return needed ? Math.max(0, right - wrong) / needed : 0;
  },
  reveal: (pub, secret) => ({ kind: "queens", size: pub.size, queens: secret.solution, givens: pub.givens, blocked: pub.blocked }),
};
