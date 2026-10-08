// Rebuilds data/words/generated/*.json from the editable sources in data/words/
// plus the MIT `word-list` package.
//   data/words/wordhunt-answers.txt      Word Hunt answers (one word per line)
//   data/words/anagram-packs.source.json Anagram packs ({ id, title, words })
// Usage: pnpm content:build
import fs from "node:fs";
import path from "node:path";
import dictPath from "word-list";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const wordsDir = path.join(here, "..", "..", "..", "data", "words");
const outDir = path.join(wordsDir, "generated");
fs.mkdirSync(outDir, { recursive: true });

const dict = fs.readFileSync(dictPath, "utf8").split("\n").map((w) => w.trim().toLowerCase());

// Word Hunt: valid guesses = every 5-letter word, answers = the curated list.
const answerLines = fs.readFileSync(path.join(wordsDir, "wordhunt-answers.txt"), "utf8").split("\n");
const answers = [...new Set(answerLines.map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#")))];
const bad = answers.filter((w) => !/^[a-z]{5}$/.test(w));
if (bad.length) console.warn(`Skipping answers that aren't 5 letters: ${bad.join(", ")}`);
const goodAnswers = answers.filter((w) => /^[a-z]{5}$/.test(w));
const valid = new Set(dict.filter((w) => /^[a-z]{5}$/.test(w)));
for (const w of goodAnswers) valid.add(w);
fs.writeFileSync(path.join(outDir, "wordhunt-answers.json"), JSON.stringify(goodAnswers));
fs.writeFileSync(path.join(outDir, "words5.json"), JSON.stringify([...valid].sort().join(" ")));

// Anagram packs: precompute dictionary anagrams so "silent" also accepts "listen".
const byKey = new Map();
for (const w of dict) {
  if (!/^[a-z]{3,8}$/.test(w)) continue;
  const k = [...w].sort().join("");
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(w);
}
const source = JSON.parse(fs.readFileSync(path.join(wordsDir, "anagram-packs.source.json"), "utf8"));
const packs = source.map((p) => {
  const words = [...new Set(p.words.map((w) => w.trim().toLowerCase()))].filter((w) => /^[a-z]{3,8}$/.test(w));
  const alts = {};
  for (const w of words) {
    const others = (byKey.get([...w].sort().join("")) || []).filter((x) => x !== w);
    if (others.length) alts[w] = others;
  }
  return { id: p.id, title: p.title, words, alts };
});
fs.writeFileSync(path.join(outDir, "anagram-packs.json"), JSON.stringify(packs, null, 1));
console.log(`answers=${goodAnswers.length} valid=${valid.size} packs=${packs.map((p) => `${p.id}:${p.words.length}`).join(",")}`);
