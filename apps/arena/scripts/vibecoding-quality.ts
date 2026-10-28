/**
 * pnpm vibecoding:quality — can the real Gemini models build every tile? (spec 16.6, Gate 0.5)
 *
 *   For each model: the 24-prompt corpus, each starting from the tile's starter.
 *   After a failed Check the "student" asks again with the crossed-out items
 *   (up to 3 Asks). pass@1 = passed on the first Ask, pass@3 = within 3.
 *   Gate: for each primary model, pass@3 ≥ 70% overall and ≥ 2 of 3 on every tile.
 *
 *   --models a,b        only these model ids (default: every model in models.json)
 *   --simple t1,t2      use the simple variant for these tiles
 *   --tiles t1,t2       only these tiles
 *   --gateway           go through the full gateway chain (failover) instead of one model at a time
 *   --data <dir>        arena-data folder holding the key (default apps/arena/arena-data)
 *
 * Results: docs/competitions/vibecoding-quality.md (summary) and
 * <data>/competitions/vibecoding/quality/<time>.json (every prompt, answer and check).
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { checklist, MODELS, TILE_IDS, tileConfig, type ModelConfig, type ScoredTileId, type Variant } from "@iedc/shared/competitions/vibecoding/config";
import { parseAnswer } from "@iedc/shared/competitions/vibecoding/parser";
import { starterFragment } from "@iedc/shared/competitions/vibecoding/tiles/index";
import type { CheckResult, Fragment } from "@iedc/shared/competitions/vibecoding/state";
import { AiGateway } from "../src/competitions/vibecoding/ai/gateway";
import { GeminiProvider } from "../src/competitions/vibecoding/ai/gemini";
import { buildPrompt } from "../src/competitions/vibecoding/ai/prompt";
import { readKey } from "../src/competitions/vibecoding/ai/key";
import { runJob } from "../src/competitions/vibecoding/checks/run";
import { CORPUS, followUp, type CorpusPrompt } from "./vibecoding-corpus";

const { values: args } = parseArgs({
  options: {
    models: { type: "string" },
    simple: { type: "string", default: "" },
    tiles: { type: "string", default: "" },
    gateway: { type: "boolean", default: false },
    data: { type: "string", default: path.resolve("arena-data") },
    concurrency: { type: "string", default: "4" },
  },
});
const dir = path.join(args.data!, "competitions", "vibecoding");
const key = readKey(dir);
if (!key) {
  console.error(`No key. Set GEMINI_API_KEY or put it in ${path.join(dir, "gemini-key.txt")}`);
  process.exit(1);
}
const simple = new Set(args.simple!.split(",").filter(Boolean));
const onlyTiles = new Set(args.tiles!.split(",").filter(Boolean));
const variantOf = (t: ScoredTileId): Variant => (simple.has(t) ? "simple" : tileConfig(t).variant);
const corpus = CORPUS.filter((c) => !onlyTiles.size || onlyTiles.has(c.tile));
const chosen = args.models ? MODELS.models.filter((m) => args.models!.split(",").includes(m.id)) : MODELS.models;
if (!chosen.length) {
  console.error("No such model in models.json. Run pnpm vibecoding:models to see the ids.");
  process.exit(1);
}

interface Attempt {
  ask: string;
  ok: boolean;
  model?: string;
  ms: number;
  reason?: string;
  explanation?: string;
  fragment?: Fragment;
  failing?: string[];
}
interface Run {
  model: string;
  prompt: CorpusPrompt;
  variant: Variant;
  passedAt: number | null;
  attempts: Attempt[];
}

const gemini = new GeminiProvider(() => key);
const usageFile = path.join(dir, "ai-usage.json");
fs.mkdirSync(dir, { recursive: true });

async function runOne(gw: AiGateway, label: string, p: CorpusPrompt): Promise<Run> {
  const variant = variantOf(p.tile);
  let fragment = starterFragment(p.tile, variant);
  let ask = p.text;
  const run: Run = { model: label, prompt: p, variant, passedAt: null, attempts: [] };
  for (let n = 1; n <= 3; n++) {
    const prompt = buildPrompt({ tileId: p.tile, variant, fragment, notes: "", teamName: "Byte Me", ask });
    const t0 = Date.now();
    const r = await gw.complete(`q-${p.tile}-${p.level}`, prompt, (text) => {
      const parsed = parseAnswer(text);
      return parsed.ok ? parsed : null;
    });
    const a: Attempt = { ask, ok: r.ok, ms: Date.now() - t0 };
    run.attempts.push(a);
    if (!r.ok) {
      a.reason = r.reason;
      continue; // a student would just Ask again
    }
    a.model = r.model;
    a.explanation = r.value.explanation;
    fragment = r.value.fragment;
    a.fragment = fragment;
    const c = runJob({ kind: "tile", tileId: p.tile, variant, fragment, teamName: "Byte Me" }) as CheckResult;
    const items = checklist(p.tile, variant);
    a.failing = items.filter((i) => !c.items[i.id]).map((i) => i.text);
    if (a.failing.length === 0) {
      run.passedAt = n;
      break;
    }
    ask = followUp(a.failing);
  }
  const mark = run.passedAt ? `✓ pass@${run.passedAt}` : "✗ failed";
  console.log(`  ${label.padEnd(24)} ${p.tile.padEnd(9)} ${p.level.padEnd(8)} ${p.lang.padEnd(8)} ${mark}${run.passedAt ? "" : `  (${run.attempts.at(-1)?.reason ?? run.attempts.at(-1)?.failing?.join("; ")})`}`);
  return run;
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, n) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

const runs: Run[] = [];
const groups: { label: string; models: ModelConfig[] }[] = args.gateway ? [{ label: "gateway", models: chosen }] : chosen.map((m) => ({ label: m.id, models: [m] }));
for (const g of groups) {
  console.log(`\n${g.label}: ${corpus.length} prompts…`);
  const gw = new AiGateway({ provider: gemini, models: g.models, retries: args.gateway ? 2 : 0, usageFile, maxInFlight: 4, failFast: false, keepAlive: true, timeoutMs: MODELS.timeoutMs, maxOutputTokens: MODELS.maxOutputTokens });
  runs.push(...(await pool(corpus, Number(args.concurrency), (p) => runOne(gw, g.label, p))));
  const errs = gw.health().map((m) => `${m.id}: ${m.errors} errors${m.lastError ? ` (last: ${m.lastError})` : ""}`);
  console.log(`  ${errs.join("; ")}`);
}

/* ---------------- report ---------------- */
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
};
const lines: string[] = [];
const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
lines.push(`## Run ${stamp} UTC${simple.size ? ` (simple: ${[...simple].join(", ")})` : ""}${args.gateway ? " (through the gateway)" : ""}`, "");
lines.push("| Model | pass@1 | pass@3 | Latency p50 / p95 | System instruction | Gate |", "|---|---|---|---|---|---|");
const verdicts: string[] = [];
for (const g of groups) {
  const rs = runs.filter((r) => r.model === g.label);
  const p1 = rs.filter((r) => r.passedAt === 1).length;
  const p3 = rs.filter((r) => r.passedAt != null).length;
  const lat = rs.flatMap((r) => r.attempts.filter((a) => a.ok).map((a) => a.ms));
  const tilesOk = TILE_IDS.filter((t) => corpus.some((c) => c.tile === t)).every((t) => rs.filter((r) => r.prompt.tile === t && r.passedAt != null).length >= 2);
  const primary = g.models.some((m) => m.role === "primary");
  const gate = p3 / Math.max(1, rs.length) >= 0.7 && tilesOk;
  const sys = g.models.map((m) => (gemini.noSystem.has(m.id) ? "no (in message)" : "yes")).join(", ");
  lines.push(`| ${g.label} | ${pct(p1, rs.length)} | ${pct(p3, rs.length)} | ${(quantile(lat, 0.5) / 1000).toFixed(1)} s / ${(quantile(lat, 0.95) / 1000).toFixed(1)} s | ${sys} | ${primary || args.gateway ? (gate ? "✅ met" : "❌ not met") : "(overflow)"} |`);
  if ((primary || args.gateway) && !gate) verdicts.push(g.label);
}
lines.push("", "Per tile (prompts passed within 3 Asks, out of 3):", "", `| Tile | ${groups.map((g) => g.label).join(" | ")} |`, `|---|${groups.map(() => "---").join("|")}|`);
for (const t of TILE_IDS) {
  if (!corpus.some((c) => c.tile === t)) continue;
  const cells = groups.map((g) => {
    const rs = runs.filter((r) => r.model === g.label && r.prompt.tile === t);
    const ok = rs.filter((r) => r.passedAt != null).length;
    return `${ok}/${rs.length}${ok < 2 ? " ⚠️" : ""}`;
  });
  lines.push(`| ${tileConfig(t).title}${simple.has(t) ? " (simple)" : ""} | ${cells.join(" | ")} |`);
}
lines.push("", "By level (pass@3): " + (["vague", "medium", "detailed"] as const).map((l) => `${l} ${pct(runs.filter((r) => r.prompt.level === l && r.passedAt != null).length, runs.filter((r) => r.prompt.level === l).length)}`).join(", "), "");
const report = lines.join("\n");
console.log(`\n${report}`);
console.log(verdicts.length ? `\nGate NOT met for: ${verdicts.join(", ")}. See spec 16.6 "If it fails".` : "\nGate met.");

const md = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..", "..", "..", "docs", "competitions", "vibecoding-quality.md");
const head = "# Vibe Hackathon: AI quality runs\n\nEach run is `pnpm vibecoding:quality` (spec 16.6). Newest first.\n\n";
const old = fs.existsSync(md) ? fs.readFileSync(md, "utf8").replace(head, "") : "";
fs.writeFileSync(md, `${head}${report}\n${old}`);
const out = path.join(dir, "quality");
fs.mkdirSync(out, { recursive: true });
const file = path.join(out, `${stamp.replace(/[: ]/g, "-")}.json`);
fs.writeFileSync(file, JSON.stringify(runs, null, 2));
console.log(`\nSummary: ${md}\nDetails: ${file}\n`);
