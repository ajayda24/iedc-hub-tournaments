// Checks that everything is in place and says how to fix what isn't.
//   pnpm check-setup
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { execSync } from "node:child_process";
import { activeCollege } from "./use-college.mjs";
import { dataFolders, describe, root } from "./data-folders.mjs";

let problems = 0;
const ok = (s) => console.log(`  ✓ ${s}`);
const warn = (s, fix) => (problems++, console.log(`  ✖ ${s}${fix ? `\n      → ${fix}` : ""}`));
const info = (s) => console.log(`    ${s}`);

console.log("\n  Checking your setup…\n");

const [major, minor] = process.versions.node.split(".").map(Number);
if (major > 20 || (major === 20 && minor >= 11)) ok(`Node.js ${process.versions.node}`);
else warn(`Node.js ${process.versions.node} is too old`, "install Node.js 20 LTS or newer from https://nodejs.org");

try {
  ok(`pnpm ${execSync("pnpm --version", { encoding: "utf8" }).trim()}`);
} catch {
  warn("pnpm is not installed", "run: npm install -g pnpm");
}

if (fs.existsSync(path.join(root, "node_modules"))) ok("packages installed");
else warn("packages are not installed", "run: pnpm install");

const { id, from } = activeCollege();
if (fs.existsSync(path.join(root, "colleges", id, "college.ts"))) ok(`college "${id}" (${from})`);
else warn(`college "${id}" has no profile in colleges/${id}/`, "run: pnpm new-college");

if (fs.existsSync(path.join(root, "apps", "web", "out", "index.html"))) ok("website built (apps/web/out)");
else warn("website not built yet", "run: pnpm build (or pnpm kit for the event laptop)");

const kits = fs.existsSync(path.join(root, "dist")) ? fs.readdirSync(path.join(root, "dist")).filter((d) => fs.existsSync(path.join(root, "dist", d, "app", "arena.mjs")) || fs.existsSync(path.join(root, "dist", d, "arena.mjs"))) : [];
if (kits.length) ok(`event kit(s): ${kits.map((k) => `dist/${k}`).join(", ")}`);
else warn("no event kit built yet", "run: pnpm kit");

const free = await new Promise((r) => {
  const s = net.createServer().once("error", () => r(false)).once("listening", () => s.close(() => r(true)));
  s.listen(4000);
});
if (free) ok("port 4000 is free");
else warn("port 4000 is busy — the arena is already running, or another app uses it", "close the other arena window, or start with --port 4001");

const folders = dataFolders();
if (!folders.length) info("No event data yet (it appears after the first event).");
for (const f of folders) {
  const d = describe(f.dir);
  ok(`data (${f.label}): ${d.students} students, ${d.tournaments} tournaments, ${d.players} players in the current event`);
  info(path.relative(root, f.dir));
}
if (folders.length) info("Back it up after every event: pnpm backup");

console.log(problems ? `\n  ${problems} thing(s) to fix above.\n` : "\n  All good!\n");
process.exit(problems ? 1 : 0);
