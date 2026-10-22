// Copies every arena-data/ folder in this checkout (dev and built kits) into
// backups/<date-time>/. Nothing is moved or deleted.
//
//   pnpm backup
//   pnpm backup --from "D:\event-kit-iedc\arena-data"     a folder somewhere else
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { dataFolders, describe, root } from "./data-folders.mjs";

const { values: flags } = parseArgs({ options: { from: { type: "string", multiple: true } } });
const folders = flags.from?.length ? flags.from.map((dir) => ({ dir: path.resolve(dir), label: dir, name: path.basename(path.dirname(path.resolve(dir))) || "arena-data" })) : dataFolders();
if (!folders.length) {
  console.log("\n  No arena-data folders found yet — nothing to back up.\n");
  process.exit(0);
}

const d0 = new Date();
const p2 = (n) => String(n).padStart(2, "0");
const stamp = `${d0.getFullYear()}-${p2(d0.getMonth() + 1)}-${p2(d0.getDate())}_${p2(d0.getHours())}-${p2(d0.getMinutes())}-${p2(d0.getSeconds())}`;
const dest = path.join(root, "backups", stamp);
console.log("");
for (const f of folders) {
  if (!fs.existsSync(f.dir)) {
    console.log(`  ✖ ${f.dir} doesn't exist`);
    continue;
  }
  const to = path.join(dest, f.name);
  fs.cpSync(f.dir, to, { recursive: true });
  const d = describe(f.dir);
  console.log(`  ✓ ${f.label}: ${d.students} students, ${d.tournaments} tournaments → ${path.relative(root, to)}`);
}
console.log(`\n  Saved in backups/${stamp}/. It contains Student IDs: keep it private, never commit it.`);
console.log("  Copy it to a pen drive or Google Drive too.\n");
