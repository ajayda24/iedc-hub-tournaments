// Publishes the monthly leaderboard you downloaded from the host console
// (Monthly tab → Download for website) into the active college's profile.
//
//   pnpm leaderboard "C:\Users\me\Downloads\monthly.json"
//
// It refuses files that would quietly drop tournaments already on the website
// (for example a download from a laptop that lost its history). Use --force if
// that's really what you want.
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { activeCollege } from "./use-college.mjs";
import { root } from "./data-folders.mjs";

const { values: flags, positionals } = parseArgs({ options: { force: { type: "boolean", default: false } }, allowPositionals: true });
const fail = (msg) => {
  console.error(`\n  ✖ ${msg}\n`);
  process.exit(1);
};
if (!positionals[0]) fail('Which file? Example: pnpm leaderboard "C:\\Users\\me\\Downloads\\monthly.json"');

const src = path.resolve(positionals[0]);
if (!fs.existsSync(src)) fail(`No file at ${src}`);
const text = fs.readFileSync(src, "utf8");
if (text.includes('"studentId"')) fail("That's a private history backup (it has Student IDs), not the website file. Use Monthly → Download for website.");
let next;
try {
  next = JSON.parse(text);
} catch {
  fail("That file isn't valid JSON.");
}
if (typeof next?.updatedAt !== "string" || typeof next?.months !== "object") fail("That doesn't look like a monthly leaderboard file (Monthly → Download for website).");

const { id } = activeCollege();
const dest = path.join(root, "colleges", id, "monthly.json");
const current = fs.existsSync(dest) ? JSON.parse(fs.readFileSync(dest, "utf8")) : { months: {} };

// would anything already published disappear?
const lost = [];
for (const [month, m] of Object.entries(current.months ?? {})) {
  const kept = new Set((next.months[month]?.tournaments ?? []).map((t) => `${t.name}@${t.date}`));
  for (const t of m.tournaments ?? []) if (!kept.has(`${t.name}@${t.date}`)) lost.push(`${month}: ${t.name} (${new Date(t.date).toLocaleDateString()}, ${t.players} players)`);
}
if (lost.length && !flags.force) {
  fail(
    `This file would remove ${lost.length} tournament(s) that are on the website now:\n      ${lost.join("\n      ")}\n\n` +
      "    That usually means the laptop's history is missing them. Import a history backup on the laptop\n" +
      "    (Monthly → Import backup), download again, and retry. Or add --force if removing them is intended.",
  );
}

fs.writeFileSync(dest, JSON.stringify(next, null, 2) + "\n");
const latest = Object.keys(next.months).sort().pop();
const top = latest ? next.months[latest].standings.slice(0, 3).map((r, i) => `${i + 1}. ${r.name} (${r.dept}) ${r.points}`) : [];
console.log(`\n  ✓ Updated colleges/${id}/monthly.json`);
if (latest) console.log(`    ${latest}: ${next.months[latest].tournaments.length} tournament(s)\n    ${top.join("\n    ")}`);
console.log(`
  Publish it:
    git add colleges/${id}/monthly.json
    git commit -m "Update monthly leaderboard"
    git push
  Vercel rebuilds the website in a minute or two.
`);
