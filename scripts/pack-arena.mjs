// Produces dist/brain-arena/: everything the event laptop needs, no install step.
//   arena.mjs  web/  start-arena.bat  start-arena.sh  setup-hotspot.ps1  start-hotspot.ps1  README.txt
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist", "brain-arena");
const run = (cmd) => execSync(cmd, { stdio: "inherit", cwd: root });

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

if (!process.argv.includes("--skip-web")) run("pnpm --filter @iedc/web build");
run(`node apps/arena/build.mjs "${path.join(out, "arena.mjs")}"`);
fs.cpSync(path.join(root, "apps", "web", "out"), path.join(out, "web"), { recursive: true });
// the service worker is only for the online site; the LAN copy doesn't need it
for (const f of fs.readdirSync(path.join(out, "web"))) if (/^(sw|swe-worker)/.test(f)) fs.rmSync(path.join(out, "web", f));
for (const f of ["start-arena.bat", "start-arena.sh", "setup-hotspot.ps1", "start-hotspot.ps1"]) {
  fs.copyFileSync(path.join(root, "scripts", "windows", f), path.join(out, f));
}
fs.chmodSync(path.join(out, "start-arena.sh"), 0o755);
fs.copyFileSync(path.join(root, "docs", "EVENT_DAY.md"), path.join(out, "README.txt"));
const size = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`\nPacked ${path.relative(root, out)} (${(size(out) / 1024 / 1024).toFixed(1)} MB). Copy that folder to the event laptop and run start-arena.`);
