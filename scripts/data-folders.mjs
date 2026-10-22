// Finds every arena-data/ folder in this checkout: the one used by `pnpm dev`
// and the ones inside built event kits in dist/. Shared by backup and doctor.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export function dataFolders() {
  const found = [];
  const add = (dir, label, name) => fs.existsSync(dir) && fs.statSync(dir).isDirectory() && found.push({ dir, label, name });
  add(path.join(root, "arena-data"), "pnpm dev / pnpm start", "dev");
  add(path.join(root, "apps", "arena", "arena-data"), "pnpm dev (older location)", "dev-old-location");
  const dist = path.join(root, "dist");
  if (fs.existsSync(dist)) {
    for (const d of fs.readdirSync(dist)) add(path.join(dist, d, "arena-data"), `kit dist/${d}`, d);
  }
  return found;
}

/** What's inside a data folder, in plain words. */
export function describe(dir) {
  const read = (f) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    } catch {
      return null;
    }
  };
  const students = read("students.json");
  const history = read("history.json");
  const snap = read("snapshot.json");
  return {
    students: Array.isArray(students) ? students.length : 0,
    tournaments: history?.tournaments?.length ?? 0,
    players: snap?.players?.length ?? 0,
  };
}
