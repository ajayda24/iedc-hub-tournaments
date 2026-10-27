import { createRng } from "../../rng";

/**
 * The 3×3 sliding puzzle. Cells hold piece 1..8, 0 is the empty slot.
 * Solved = [1,2,3,4,5,6,7,8,0] (empty slot bottom right).
 */
export const SOLVED = [1, 2, 3, 4, 5, 6, 7, 8, 0];

export const isSolved = (b: readonly number[]) => b.every((v, i) => v === SOLVED[i]);

/** Cells next to `i` (up, down, left, right). */
export function neighbours(i: number): number[] {
  const r = Math.floor(i / 3);
  const c = i % 3;
  const out: number[] = [];
  if (r > 0) out.push(i - 3);
  if (r < 2) out.push(i + 3);
  if (c > 0) out.push(i - 1);
  if (c < 2) out.push(i + 1);
  return out;
}

/** Slide the piece at `cell` into the empty slot. Null when it isn't next to it. */
export function slide(board: readonly number[], cell: number): number[] | null {
  const empty = board.indexOf(0);
  if (cell === empty || !neighbours(empty).includes(cell)) return null;
  const next = board.slice();
  next[empty] = next[cell];
  next[cell] = 0;
  return next;
}

const encode = (b: readonly number[]) => b.reduce((n, v) => n * 9 + v, 0);

let DIST: Map<number, number> | null = null;

/** Distance from solved for every reachable board (181,440 states), built once by BFS. */
function distances(): Map<number, number> {
  if (DIST) return DIST;
  const dist = new Map<number, number>([[encode(SOLVED), 0]]);
  let frontier = [SOLVED.slice()];
  for (let depth = 1; frontier.length; depth++) {
    const next: number[][] = [];
    for (const b of frontier) {
      const e = b.indexOf(0);
      for (const n of neighbours(e)) {
        const c = b.slice();
        c[e] = c[n];
        c[n] = 0;
        const key = encode(c);
        if (!dist.has(key)) {
          dist.set(key, depth);
          next.push(c);
        }
      }
    }
    frontier = next;
  }
  DIST = dist;
  return dist;
}

/** Fewest moves to solve; -1 if unreachable. */
export function optimalMoves(board: readonly number[]): number {
  return distances().get(encode(board)) ?? -1;
}

/**
 * A seeded scramble: 18–26 random legal moves from solved (never undoing the
 * previous move), accepted only when the optimal solution is 8–14 moves.
 */
export function generatePuzzle(seed: number): { board: number[]; optimal: number } {
  for (let attempt = 0; ; attempt++) {
    const rng = createRng((seed ^ Math.imul(attempt + 1, 0x9e3779b1)) >>> 0);
    let board = SOLVED.slice();
    let prev = -1;
    const steps = rng.range(18, 26);
    for (let s = 0; s < steps; s++) {
      const e = board.indexOf(0);
      const options = neighbours(e).filter((n) => n !== prev);
      const pick = rng.pick(options);
      board = slide(board, pick)!;
      prev = e;
    }
    if (isSolved(board)) continue;
    const optimal = optimalMoves(board);
    if (optimal >= 8 && optimal <= 14) return { board, optimal };
  }
}

/** Partial credit at freeze: 100 × pieces in place / 8, rounded down. */
export function piecesInPlace(board: readonly number[]): number {
  return board.reduce((n, v, i) => n + (v !== 0 && v === SOLVED[i] ? 1 : 0), 0);
}
