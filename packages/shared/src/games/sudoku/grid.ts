/* Pure grid helpers, safe to import in the browser (no zod, no generator). */

/** Precomputed peer lists (row, column, box) per cell for a given shape. */
const peerCache = new Map<string, number[][]>();
export function peers(size: number, boxR: number, boxC: number): number[][] {
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

export function candidates(grid: number[], i: number, size: number, pr: number[][]): number[] {
  let used = 0;
  for (const p of pr[i]) used |= 1 << grid[p];
  const out: number[] = [];
  for (let v = 1; v <= size; v++) if (!(used & (1 << v))) out.push(v);
  return out;
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

