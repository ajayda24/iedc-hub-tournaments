/**
 * Small seeded PRNG (mulberry32). Every puzzle is generated from a seed, so the
 * same seed always yields the same puzzle on the server, in tests and in bots.
 */
export interface Rng {
  /** float in [0, 1) */
  next(): number;
  /** integer in [0, n) */
  int(n: number): number;
  /** integer in [min, max] (inclusive) */
  range(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  return {
    next,
    int,
    range: (min, max) => min + int(max - min + 1),
    pick: (arr) => arr[int(arr.length)],
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

/** A fresh random 32-bit seed (non-deterministic). */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
