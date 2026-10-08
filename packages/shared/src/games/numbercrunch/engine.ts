import { z } from "zod";
import { createRng } from "../../rng";
import { GAME_META } from "../meta";
import type { Difficulty, GameDefinition } from "../types";
import { gameText } from "@iedc/data/copy/games";

export interface CrunchPub {
  numbers: number[];
  target: number;
}
export interface CrunchSecret {
  expression: string;
}
export interface CrunchProgress {
  best: { value: number; expr: string } | null;
  attempts: number;
}
export interface CrunchFeedback {
  value?: number;
  distance?: number;
}
export type CrunchSub = { expr: string };

const LARGE = [25, 50, 75, 100];
const SMALL = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10];

interface Spec {
  count: number;
  large: [number, number];
  target: [number, number];
  use: [number, number];
}
const SPECS: Record<Difficulty, Spec> = {
  easy: { count: 5, large: [1, 1], target: [21, 150], use: [2, 3] },
  med: { count: 6, large: [1, 2], target: [101, 500], use: [3, 4] },
  hard: { count: 6, large: [1, 2], target: [501, 999], use: [4, 5] },
};

type Node = { value: number; expr: string };

function combine(a: Node, b: Node, op: string): Node | null {
  if (a.value < b.value) [a, b] = [b, a];
  switch (op) {
    case "+":
      return { value: a.value + b.value, expr: `(${a.expr} + ${b.expr})` };
    case "-":
      return a.value === b.value ? null : { value: a.value - b.value, expr: `(${a.expr} - ${b.expr})` };
    case "*":
      return a.value === 1 || b.value === 1 ? null : { value: a.value * b.value, expr: `(${a.expr} × ${b.expr})` };
    case "/":
      return b.value === 1 || a.value % b.value !== 0 ? null : { value: a.value / b.value, expr: `(${a.expr} ÷ ${b.expr})` };
  }
  return null;
}

const stripOuter = (s: string) => (s.startsWith("(") && s.endsWith(")") ? s.slice(1, -1) : s);

export function generateCrunch(seed: number, difficulty: Difficulty): { pub: CrunchPub; secret: CrunchSecret } {
  const rng = createRng(seed);
  const spec = SPECS[difficulty];
  for (;;) {
    const nLarge = rng.range(spec.large[0], spec.large[1]);
    const numbers = [
      ...rng.shuffle(LARGE).slice(0, nLarge),
      ...rng.shuffle(SMALL).slice(0, spec.count - nLarge),
    ].sort((a, b) => b - a);
    for (let attempt = 0; attempt < 400; attempt++) {
      const k = rng.range(spec.use[0], spec.use[1]);
      let nodes: Node[] = rng.shuffle(numbers).slice(0, k).map((v) => ({ value: v, expr: String(v) }));
      let ok = true;
      while (nodes.length > 1 && ok) {
        const i = rng.int(nodes.length);
        let j = rng.int(nodes.length - 1);
        if (j >= i) j++;
        const made = combine(nodes[i], nodes[j], rng.pick(["+", "-", "*", "*", "/"]));
        if (!made) {
          ok = false;
          break;
        }
        nodes = nodes.filter((_, x) => x !== i && x !== j);
        nodes.push(made);
      }
      if (!ok) continue;
      const v = nodes[0].value;
      if (v >= spec.target[0] && v <= spec.target[1] && !numbers.includes(v)) {
        return { pub: { numbers, target: v }, secret: { expression: stripOuter(nodes[0].expr) } };
      }
    }
  }
}

/* ---------- safe expression evaluation (positive integers only, like the TV show) ---------- */

export class ExprError extends Error {}

export function evaluateExpression(src: string, allowed: number[]): number {
  const text = src.replace(/×/g, "*").replace(/÷/g, "/").replace(/\s+/g, "");
  if (!text) throw new ExprError(gameText.numbercrunch.buildSomething);
  if (text.length > 120) throw new ExprError(gameText.numbercrunch.tooLong);
  const tokens = text.match(/\d+|[+\-*/()]/g) ?? [];
  if (tokens.join("") !== text) throw new ExprError(gameText.numbercrunch.onlyNumbersAndOps);
  let pos = 0;
  const used: number[] = [];
  const peek = () => tokens[pos];
  const step = (a: number, op: string, b: number) => {
    let r: number;
    if (op === "+") r = a + b;
    else if (op === "-") r = a - b;
    else if (op === "*") r = a * b;
    else {
      if (b === 0 || a % b !== 0) throw new ExprError(gameText.numbercrunch.divisionWhole);
      r = a / b;
    }
    if (r <= 0) throw new ExprError(gameText.numbercrunch.noNegatives);
    return r;
  };
  const factor = (): number => {
    const t = tokens[pos++];
    if (t === "(") {
      const v = expr();
      if (tokens[pos++] !== ")") throw new ExprError(gameText.numbercrunch.missingBracket);
      return v;
    }
    if (t && /^\d+$/.test(t)) {
      const n = Number(t);
      used.push(n);
      return n;
    }
    throw new ExprError(gameText.numbercrunch.broken);
  };
  const term = (): number => {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = tokens[pos++];
      v = step(v, op, factor());
    }
    return v;
  };
  const expr = (): number => {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = tokens[pos++];
      v = step(v, op, term());
    }
    return v;
  };
  const value = expr();
  if (pos !== tokens.length) throw new ExprError(gameText.numbercrunch.broken);
  const pool = allowed.slice();
  for (const n of used) {
    const at = pool.indexOf(n);
    if (at === -1) throw new ExprError(gameText.numbercrunch.noSpare(n));
    pool.splice(at, 1);
  }
  return value;
}

/** Exhaustive search for the exact target (or the closest value). Used by bots and tests. */
export function solveCrunch(numbers: number[], target: number, budgetMs = 1500): Node {
  let best: Node = { value: numbers[0], expr: String(numbers[0]) };
  const consider = (n: Node) => {
    if (Math.abs(n.value - target) < Math.abs(best.value - target)) best = n;
  };
  const deadline = Date.now() + budgetMs;
  const seen = new Set<string>();
  const dfs = (nodes: Node[]): boolean => {
    for (const n of nodes) consider(n);
    if (best.value === target) return true;
    if (nodes.length < 2 || Date.now() > deadline) return false;
    const key = nodes.map((n) => n.value).sort((a, b) => a - b).join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const rest = nodes.filter((_, x) => x !== i && x !== j);
        for (const op of ["+", "-", "*", "/"]) {
          const m = combine(nodes[i], nodes[j], op);
          if (m && dfs([...rest, m])) return true;
        }
      }
    }
    return false;
  };
  dfs(numbers.map((v) => ({ value: v, expr: String(v) })));
  return { value: best.value, expr: stripOuter(best.expr) };
}

export const numbercrunch: GameDefinition<CrunchPub, CrunchSecret, CrunchSub, CrunchProgress, CrunchFeedback> = {
  ...GAME_META.numbercrunch,
  subSchema: z.object({ expr: z.string().max(160) }),
  generate: (seed, difficulty) => generateCrunch(seed, difficulty),
  initialProgress: () => ({ best: null, attempts: 0 }),
  check(pub, _secret, progress, sub) {
    let value: number;
    try {
      value = evaluateExpression(sub.expr, pub.numbers);
    } catch (e) {
      return { status: "invalid", progress, message: e instanceof ExprError ? e.message : gameText.numbercrunch.broken };
    }
    const distance = Math.abs(value - pub.target);
    const prevBest = progress.best ? Math.abs(progress.best.value - pub.target) : Infinity;
    const next: CrunchProgress = {
      attempts: progress.attempts + 1,
      best: distance < prevBest ? { value, expr: sub.expr } : progress.best,
    };
    if (distance === 0) return { status: "solved", progress: next, feedback: { value, distance } };
    return {
      status: "wrong",
      progress: next,
      feedback: { value, distance },
      message: distance <= 5 ? gameText.numbercrunch.soClose(distance) : gameText.numbercrunch.offBy(value, distance),
    };
  },
  partialCredit(pub, _secret, progress) {
    if (!progress.best) return 0;
    const d = Math.abs(progress.best.value - pub.target);
    return d > 10 ? 0 : 1 - d / 11;
  },
  reveal: (pub, secret) => ({ kind: "expression", target: pub.target, expression: secret.expression }),
};
