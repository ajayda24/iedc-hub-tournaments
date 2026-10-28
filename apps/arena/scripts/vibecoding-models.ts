/**
 * pnpm vibecoding:models — which Gemini models can this key use, and do they work?
 *   Lists every model the key can call (Gemma and Flash-Lite first), then sends
 *   one realistic tile request to each model in config/competitions/vibecoding/models.json
 *   and reports latency, errors, whether system instructions work, and whether the answer passes.
 *   Key: GEMINI_API_KEY, or --data <arena-data> (default apps/arena/arena-data).
 */
import path from "node:path";
import { parseArgs } from "node:util";
import { MODELS } from "@iedc/shared/competitions/vibecoding/config";
import { parseAnswer } from "@iedc/shared/competitions/vibecoding/parser";
import { starterFragment } from "@iedc/shared/competitions/vibecoding/tiles/index";
import type { CheckResult } from "@iedc/shared/competitions/vibecoding/state";
import { GeminiProvider } from "../src/competitions/vibecoding/ai/gemini";
import { buildPrompt } from "../src/competitions/vibecoding/ai/prompt";
import { readKey } from "../src/competitions/vibecoding/ai/key";
import { runJob } from "../src/competitions/vibecoding/checks/run";

const { values: args } = parseArgs({ options: { data: { type: "string", default: path.resolve("arena-data") }, all: { type: "boolean", default: false } } });
const dir = path.join(args.data!, "competitions", "vibecoding");
const key = readKey(dir);
if (!key) {
  console.error(`No key. Set GEMINI_API_KEY or put it in ${path.join(dir, "gemini-key.txt")}`);
  process.exit(1);
}
const gemini = new GeminiProvider(() => key);

const list = await gemini.listModels();
const interesting = list.filter((m) => args.all || /gemma|flash-lite|flash/i.test(m.id));
console.log(`\nModels this key can use (${list.length} total${args.all ? "" : "; Gemma/Flash shown, --all for every one"}):`);
for (const m of interesting) console.log(`  ${m.id.padEnd(40)} ${m.label}`);

const ask = "Create a hero banner with the heading 'IEDC Fest 2026', the tagline 'Build. Break. Launch.', a purple-to-orange gradient background and a 'Register now' button.";
const prompt = buildPrompt({ tileId: "hero", variant: "full", fragment: starterFragment("hero", "full"), notes: "", teamName: "Byte Me", ask });
console.log("\nProbing the models in models.json with one hero request:");
for (const m of MODELS.models) {
  const known = list.some((x) => x.id === m.id);
  const t0 = Date.now();
  try {
    const r = await gemini.generate({ model: m.id, thinkingLevel: m.thinkingLevel, prompt, maxOutputTokens: MODELS.maxOutputTokens, timeoutMs: MODELS.timeoutMs });
    const ms = Date.now() - t0;
    const parsed = parseAnswer(r.text);
    let pass = "unparseable";
    if (parsed.ok) {
      const c = runJob({ kind: "tile", tileId: "hero", variant: "full", fragment: parsed.fragment, teamName: "Byte Me" }) as CheckResult;
      pass = `${c.passed}/${c.total} checks`;
    }
    console.log(`  ✓ ${m.id.padEnd(28)} ${String(ms).padStart(6)} ms  system instruction: ${gemini.noSystem.has(m.id) ? "NO (sent in the message)" : "yes"}  answer: ${pass}`);
  } catch (e) {
    console.log(`  ✗ ${m.id.padEnd(28)} ${known ? "" : "(not in this key's model list) "}${e instanceof Error ? e.message : e}`);
  }
}
console.log("\nIf an id above is wrong, copy the right one from the list into config/competitions/vibecoding/models.json.\n");
