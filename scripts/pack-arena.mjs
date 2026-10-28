// Produces dist/brain-arena/: everything the event laptop needs, no install step.
// Safe to re-run on a kit that was already used: arena-data/ is left untouched.
//   arena.mjs  checks-worker.cjs  web/  start-arena.bat  start-vibe-hackathon.bat  start-arena.sh  setup-hotspot.ps1  start-hotspot.ps1  README.txt
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
// --out <folder> builds somewhere else (handy for testing without touching the real kit)
const outArg = process.argv.indexOf("--out");
const out = outArg > 0 ? path.resolve(process.argv[outArg + 1]) : path.join(root, "dist", "brain-arena");
const run = (cmd) => execSync(cmd, { stdio: "inherit", cwd: root });

// Only replace what this script builds. Never wipe the whole folder: the laptop's
// live data (arena-data/: PINs, tournament history, results) lives inside it.
const BUILT = ["arena.mjs", "checks-worker.cjs", "web", "start-arena.bat", "start-vibe-hackathon.bat", "start-arena.sh", "setup-hotspot.ps1", "start-hotspot.ps1", "README.txt"];
fs.mkdirSync(out, { recursive: true });
for (const f of BUILT) fs.rmSync(path.join(out, f), { recursive: true, force: true });

if (!process.argv.includes("--skip-web")) run("pnpm --filter @iedc/web build");
run(`node apps/arena/build.mjs "${path.join(out, "arena.mjs")}"`);
fs.cpSync(path.join(root, "apps", "web", "out"), path.join(out, "web"), { recursive: true });
// the service worker is only for the online site; the LAN copy doesn't need it
for (const f of fs.readdirSync(path.join(out, "web"))) if (/^(sw|swe-worker)/.test(f)) fs.rmSync(path.join(out, "web", f));
for (const f of ["start-arena.bat", "start-vibe-hackathon.bat", "start-arena.sh", "setup-hotspot.ps1", "start-hotspot.ps1"]) {
  fs.copyFileSync(path.join(root, "scripts", "event-kit", f), path.join(out, f));
}
fs.chmodSync(path.join(out, "start-arena.sh"), 0o755);
fs.copyFileSync(path.join(root, "docs", "EVENT_DAY.md"), path.join(out, "README.txt"));
const size = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`\nPacked ${path.relative(root, out)} (${(size(out) / 1024 / 1024).toFixed(1)} MB). Copy that folder to the event laptop and run start-arena.`);
