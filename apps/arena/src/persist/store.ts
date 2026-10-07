import fs from "node:fs";
import path from "node:path";
import type { Arena, ArenaSnapshot } from "../arena";

/**
 * Crash safety: a JSON snapshot rewritten (atomically) whenever the arena
 * changes, plus an append-only JSONL log of everything that happened.
 */
export class Store {
  private snapFile: string;
  private logStream: fs.WriteStream;
  private lastVersion = -1;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    this.snapFile = path.join(dir, "snapshot.json");
    this.logStream = fs.createWriteStream(path.join(dir, "events.jsonl"), { flags: "a" });
  }

  load(): ArenaSnapshot | null {
    try {
      const s = JSON.parse(fs.readFileSync(this.snapFile, "utf8")) as ArenaSnapshot;
      return s?.v === 1 ? s : null;
    } catch {
      return null;
    }
  }

  log(type: string, data: Record<string, unknown>) {
    this.logStream.write(JSON.stringify({ t: Date.now(), type, ...data }) + "\n");
  }

  watch(arena: Arena, everyMs = 1500) {
    this.timer = setInterval(() => this.save(arena), everyMs);
  }

  save(arena: Arena) {
    if (arena.version === this.lastVersion) return;
    this.lastVersion = arena.version;
    const tmp = this.snapFile + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(arena.snapshot()));
    fs.renameSync(tmp, this.snapFile);
  }

  exportCsv(arena: Arena): string {
    const csv = arena.toCsv();
    const file = path.join(this.dir, `results-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`);
    fs.writeFileSync(file, csv);
    return file;
  }

  close(arena: Arena) {
    if (this.timer) clearInterval(this.timer);
    this.save(arena);
    this.logStream.end();
  }
}
