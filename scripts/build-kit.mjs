// Builds the event kit: everything the event laptop needs, no install step.
//
//   pnpm kit                 → dist/event-kit-<college>/  and  dist/event-kit-<college>.zip
//   pnpm kit --skip-web      reuse the last web build
//   pnpm kit --no-zip        folder only
//
// Safe to re-run on a kit that was already used: arena-data/ and backups/ are
// never touched, only the files this script builds are replaced.
//
//   1-FIRST-TIME-SETUP.bat  2-START-EVENT.bat  START-FRESH-EVENT.bat  BACKUP-DATA.bat
//   start-event.sh  README.txt  app/ (arena.mjs, web/, hotspot scripts)
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { activeCollege } from "./use-college.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { id } = activeCollege();
const name = `event-kit-${id}`;
const out = path.join(root, "dist", name);
const kitSrc = path.join(root, "kit");
const run = (cmd) => execSync(cmd, { stdio: "inherit", cwd: root });

// Only replace what this script builds. Never wipe the whole folder: the laptop's
// live data (arena-data/: PINs, tournament history, results) may live inside it.
const BUILT = [...fs.readdirSync(kitSrc), "README.txt"];
fs.mkdirSync(out, { recursive: true });
for (const f of BUILT) fs.rmSync(path.join(out, f), { recursive: true, force: true });

if (!process.argv.includes("--skip-web")) run("pnpm --filter @iedc/web build");
const app = path.join(out, "app");
fs.cpSync(kitSrc, out, { recursive: true });
run(`node apps/arena/build.mjs "${path.join(app, "arena.mjs")}"`);
fs.cpSync(path.join(root, "apps", "web", "out"), path.join(app, "web"), { recursive: true });
// the service worker is only for the online site; the LAN copy doesn't need it
for (const f of fs.readdirSync(path.join(app, "web"))) if (/^(sw|swe-worker)/.test(f)) fs.rmSync(path.join(app, "web", f));
fs.chmodSync(path.join(out, "start-event.sh"), 0o755);
fs.copyFileSync(path.join(root, "docs", "EVENT_DAY.md"), path.join(out, "README.txt"));

const size = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`\nBuilt dist/${name}/ (${(size(out) / 1024 / 1024).toFixed(1)} MB) for college "${id}".`);

if (!process.argv.includes("--no-zip")) {
  // zip only the program, never a laptop's arena-data/ or backups/
  const zip = path.join(root, "dist", `${name}.zip`);
  fs.rmSync(zip, { force: true });
  const staging = path.join(root, "dist", ".kit-zip", name);
  fs.rmSync(path.dirname(staging), { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  for (const f of BUILT) if (fs.existsSync(path.join(out, f))) fs.cpSync(path.join(out, f), path.join(staging, f), { recursive: true });
  if (process.platform === "win32") {
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${staging}' -DestinationPath '${zip}'"`, { stdio: "inherit" });
  } else {
    execSync(`zip -qr "${zip}" "${name}"`, { stdio: "inherit", cwd: path.dirname(staging) });
  }
  fs.rmSync(path.dirname(staging), { recursive: true, force: true });
  console.log(`Zipped  dist/${name}.zip — share this, or copy the folder to the event laptop.`);
}
console.log(`On the laptop: run 1-FIRST-TIME-SETUP.bat once, then 2-START-EVENT.bat on the day.\n`);
