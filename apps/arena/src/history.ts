import fs from "node:fs";
import path from "node:path";
import { buildMonthlyFile, computeMonth, mergeHistory, monthKey, type HistoryTournament, type MonthlyFile } from "@iedc/shared";
import { MONTHLY } from "@iedc/data/rules";
import { errors } from "@iedc/data/copy/errors";

/**
 * Every finished tournament on this laptop, kept in arena-data/history.json
 * (Student IDs included — this file stays on the laptop). The public website
 * only ever gets `exportMonthly()`, which has no Student IDs.
 */
export class History {
  private list: HistoryTournament[] = [];
  private file: string | null;
  /** when the history last changed, shown as "last updated" on /leaderboard */
  updatedAt = Date.now();

  constructor(dir: string | null, private now: () => number = Date.now) {
    this.file = dir ? path.join(dir, "history.json") : null;
    if (this.file && fs.existsSync(this.file)) {
      try {
        const saved = JSON.parse(fs.readFileSync(this.file, "utf8")) as { updatedAt: number; tournaments: HistoryTournament[] };
        this.list = saved.tournaments ?? [];
        this.updatedAt = saved.updatedAt ?? this.updatedAt;
      } catch {
        /* keep going with an empty history; the broken file is replaced on next save */
      }
    }
  }

  private save() {
    this.updatedAt = this.now();
    if (!this.file) return;
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify({ updatedAt: this.updatedAt, tournaments: this.list }, null, 1));
    fs.renameSync(tmp, this.file);
  }

  all(): HistoryTournament[] {
    return this.list.slice().sort((a, b) => b.date - a.date);
  }

  has(id: string) {
    return this.list.some((t) => t.id === id);
  }

  /**
   * Save a finished tournament. Recording the same tournament again updates
   * its results (e.g. the host awarded points after the podium) but keeps the
   * host's include/name choices.
   */
  record(summary: { id: string; name: string; players: HistoryTournament["players"] }): { ok: boolean; error?: string } {
    if (summary.players.length === 0) return { ok: false, error: errors.nothingToRecord };
    const existing = this.list.find((t) => t.id === summary.id);
    if (existing) {
      existing.players = summary.players;
    } else {
      const date = this.now();
      this.list.push({ id: summary.id, name: summary.name, date, month: monthKey(date), included: true, players: summary.players });
    }
    this.save();
    return { ok: true };
  }

  edit(id: string, patch: { included?: boolean; name?: string; remove?: boolean }): { ok: boolean; error?: string } {
    const t = this.list.find((x) => x.id === id);
    if (!t) return { ok: false, error: errors.noSuchTournament };
    if (patch.remove) this.list = this.list.filter((x) => x.id !== id);
    else {
      if (patch.included !== undefined) t.included = patch.included;
      if (patch.name) t.name = patch.name;
    }
    this.save();
    return { ok: true };
  }

  import(tournaments: HistoryTournament[]): number {
    const { merged, added } = mergeHistory(this.list, tournaments);
    this.list = merged;
    if (added) this.save();
    return added;
  }

  /** Standings for one month (host preview) */
  month(month: string) {
    return computeMonth(
      this.list.filter((t) => t.month === month),
      MONTHLY,
    );
  }

  /** The anonymous file for the website / the /api/leaderboard endpoint */
  exportMonthly(): MonthlyFile {
    return buildMonthlyFile(this.list, { ...MONTHLY, now: this.updatedAt });
  }
}
