/**
 * One-off: the 9 Oct 2026 tournament's history.json was lost when the kit was
 * rebuilt. This rebuilds it from the published monthly.json as a normal history
 * backup you can load in Host console → Monthly → Import backup.
 *
 *   pnpm recover:first [--students dist/brain-arena/arena-data/students.json] [--month 2026-10]
 *
 * Run it AFTER the next event, so students.json knows the real IDs of everyone
 * who came back. It only reads files and writes backups/recovered-<month>.json.
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { recoverTournament } from "../src/recover";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const { values: args } = parseArgs({
  options: {
    monthly: { type: "string", default: path.join(root, "data", "leaderboard", "monthly.json") },
    students: { type: "string", default: path.join(root, "dist", "brain-arena", "arena-data", "students.json") },
    month: { type: "string", default: "2026-10" },
  },
});

const monthly = JSON.parse(fs.readFileSync(args.monthly!, "utf8"));
let ids: string[] = [];
if (fs.existsSync(args.students!)) {
  ids = (JSON.parse(fs.readFileSync(args.students!, "utf8")) as { studentId: string }[]).map((s) => s.studentId);
} else {
  console.warn(`! No students file at ${args.students} — nobody can be matched, everyone gets a placeholder ID.`);
}

const { tournament, matched, unmatched } = recoverTournament(monthly, args.month!, ids);
const out = path.join(root, "backups", `recovered-${args.month}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ kind: "brain-arena-history", tournaments: [tournament] }, null, 1));

console.log(`\nRecovered "${tournament.name}" (${new Date(tournament.date).toLocaleString()}), ${tournament.players.length} players.`);
console.log(`  ${matched} matched to a real Student ID (their points will add up)`);
console.log(`  ${unmatched} not seen since (kept under a placeholder ID)`);
console.log(`  top 3: ${tournament.players.slice(0, 3).map((p) => `${p.name} ${p.score}`).join(" · ")}`);
console.log(`\nWrote ${path.relative(root, out)}`);
console.log(`Next: Host console → Monthly → Import backup → pick that file. Then Download for website.\n`);
