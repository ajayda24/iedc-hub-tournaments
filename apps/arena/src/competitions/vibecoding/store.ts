import fs from "node:fs";
import path from "node:path";
import type { CompetitionState, Team } from "@iedc/shared/competitions/vibecoding/state";

/**
 * Crash safety for the competition, in arena-data/competitions/vibecoding/:
 *   state.json        everything except the teams
 *   teams/<id>.json   one file per team (only changed teams are rewritten)
 *   events.jsonl      append-only log of what happened
 * Writes are atomic (tmp + rename) and debounced (~1 s).
 */
export class CompetitionStore {
  readonly dir: string;
  private teamsDir: string;
  private logStream: fs.WriteStream;
  private savedVersion = -1;
  private savedTeams = new Map<string, number>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(dir: string) {
    this.dir = dir;
    this.teamsDir = path.join(dir, "teams");
    fs.mkdirSync(this.teamsDir, { recursive: true });
    this.logStream = fs.createWriteStream(path.join(dir, "events.jsonl"), { flags: "a" });
  }

  load(): CompetitionState | null {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(this.dir, "state.json"), "utf8")) as CompetitionState;
      if (s?.v !== 1) return null;
      s.teams = {};
      for (const id of s.teamOrder) {
        try {
          s.teams[id] = JSON.parse(fs.readFileSync(path.join(this.teamsDir, `${id}.json`), "utf8")) as Team;
        } catch {
          /* a missing team file: drop it from the order below */
        }
      }
      s.teamOrder = s.teamOrder.filter((id) => s.teams[id]);
      this.savedVersion = s.version;
      for (const t of Object.values(s.teams)) this.savedTeams.set(t.id, t.version);
      return s;
    } catch {
      return null;
    }
  }

  log(type: string, data: Record<string, unknown>) {
    this.logStream.write(JSON.stringify({ t: Date.now(), type, ...data }) + "\n");
  }

  /** Ask for a save soon (debounced). */
  schedule(get: () => CompetitionState, delayMs = 1000) {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.save(get());
    }, delayMs);
  }

  save(s: CompetitionState) {
    if (s.version === this.savedVersion) return;
    for (const t of Object.values(s.teams)) {
      if (this.savedTeams.get(t.id) === t.version) continue;
      writeAtomic(path.join(this.teamsDir, `${t.id}.json`), JSON.stringify(t));
      this.savedTeams.set(t.id, t.version);
    }
    for (const id of [...this.savedTeams.keys()]) {
      if (s.teams[id]) continue;
      fs.rmSync(path.join(this.teamsDir, `${id}.json`), { force: true });
      this.savedTeams.delete(id);
    }
    writeAtomic(path.join(this.dir, "state.json"), JSON.stringify({ ...s, teams: {} }));
    this.savedVersion = s.version;
  }

  /** Start a new run: the old one is moved to archive/<runId>/ (never deleted). */
  archive(s: CompetitionState) {
    this.save(s);
    const dest = path.join(this.dir, "archive", s.runId);
    fs.mkdirSync(dest, { recursive: true });
    for (const f of ["state.json", "teams"]) {
      const from = path.join(this.dir, f);
      if (fs.existsSync(from)) fs.renameSync(from, path.join(dest, f));
    }
    fs.mkdirSync(this.teamsDir, { recursive: true });
    this.savedVersion = -1;
    this.savedTeams.clear();
    return dest;
  }

  close(s: CompetitionState) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.save(s);
    this.logStream.end();
  }
}

export function writeAtomic(file: string, data: string) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}
