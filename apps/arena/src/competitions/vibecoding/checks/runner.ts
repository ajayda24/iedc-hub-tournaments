import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { checklist, TILE_IDS, type ScoredTileId, type TileId, type Variant } from "@iedc/shared/competitions/vibecoding/config";
import type { CheckResult, Fragment } from "@iedc/shared/competitions/vibecoding/state";
import type { CheckJob, JobResult, PageResult } from "./run";

export interface RunnerOptions {
  /** worker threads kept warm */
  size?: number;
  /** hard limit per job (spec: 3 s) */
  timeoutMs?: number;
  /** heap limit per worker */
  memoryMb?: number;
}

interface Pending {
  id: number;
  job: CheckJob;
  resolve: (r: JobResult) => void;
  reject: (e: Error) => void;
}

interface Slot {
  worker: Worker;
  ready: Promise<void>;
  busy: Pending | null;
  timer: ReturnType<typeof setTimeout> | null;
}

const here = path.dirname(fileURLToPath(import.meta.url));

/** The bundled worker next to arena.mjs in the event kit, or the TypeScript source when running from the repo. */
function workerEntry(): { file: string; execArgv: string[] } {
  const packed = path.join(here, "checks-worker.cjs");
  if (fs.existsSync(packed)) return { file: packed, execArgv: [] };
  // from the repo: load tsx by absolute path (the arena may run from any folder)
  const tsx = path.join(path.dirname(createRequire(import.meta.url).resolve("tsx/package.json")), "dist", "loader.mjs");
  return { file: path.join(here, "worker.ts"), execArgv: ["--import", pathToFileURL(tsx).href] };
}

export interface SiteCheck {
  ok: boolean;
  tiles: Record<ScoredTileId, CheckResult>;
  pageErrors: string[];
  changePassed: boolean | null;
}

/**
 * Runs checks in a small pool of worker threads. A job that runs over its time
 * (an endless loop) or memory (a memory bomb) kills its worker; the job fails,
 * a fresh worker takes its place and the arena carries on.
 */
export class CheckRunner {
  private slots: Slot[] = [];
  private queue: Pending[] = [];
  private seq = 0;
  private closed = false;
  readonly timeoutMs: number;
  /** recent job durations (ms), for the load budget */
  readonly durations: number[] = [];

  constructor(private opts: RunnerOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? 3000;
    for (let i = 0; i < (opts.size ?? 2); i++) this.slots.push(this.spawn());
  }

  private spawn(): Slot {
    const { file, execArgv } = workerEntry();
    const worker = new Worker(file, {
      execArgv,
      resourceLimits: { maxOldGenerationSizeMb: this.opts.memoryMb ?? 192, maxYoungGenerationSizeMb: 48 },
      // the usual environment, minus the AI key (student code never sees process anyway)
      env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== "GEMINI_API_KEY")),
      stdout: true,
      stderr: true,
    });
    worker.unref();
    const slot: Slot = { worker, busy: null, timer: null, ready: Promise.resolve() };
    slot.ready = new Promise<void>((resolve) => {
      const onReady = (m: { ready?: boolean }) => {
        if (m?.ready) {
          worker.off("message", onReady);
          resolve();
        }
      };
      worker.on("message", onReady);
      worker.once("error", () => resolve());
    });
    worker.on("message", (m: { id?: number; ok?: boolean; result?: JobResult; error?: string }) => {
      if (m.id == null || !slot.busy || slot.busy.id !== m.id) return;
      const p = slot.busy;
      this.finish(slot);
      if (m.ok) p.resolve(m.result!);
      else p.reject(new Error(m.error ?? "check failed"));
      this.pump();
    });
    const died = (why: string) => {
      const p = slot.busy;
      this.finish(slot);
      this.replace(slot);
      if (p) p.reject(new Error(why));
      this.pump();
    };
    worker.on("error", (e) => died(e.message));
    worker.on("exit", (code) => {
      if (!this.closed && this.slots.includes(slot)) died(`worker exited (${code})`);
    });
    return slot;
  }

  private finish(slot: Slot) {
    if (slot.timer) clearTimeout(slot.timer);
    slot.timer = null;
    slot.busy = null;
  }

  private replace(slot: Slot) {
    const i = this.slots.indexOf(slot);
    if (i < 0) return;
    this.slots.splice(i, 1);
    void slot.worker.terminate().catch(() => {});
    if (!this.closed) this.slots.push(this.spawn());
  }

  private pump() {
    for (const slot of this.slots) {
      if (slot.busy || !this.queue.length) continue;
      const p = this.queue.shift()!;
      slot.busy = p;
      const started = Date.now();
      void slot.ready.then(() => {
        if (slot.busy !== p) return;
        slot.timer = setTimeout(() => {
          if (slot.busy !== p) return;
          this.finish(slot);
          this.replace(slot);
          p.reject(new Error("timeout"));
          this.pump();
        }, this.timeoutMs);
        const done = p.resolve;
        p.resolve = (r) => {
          this.durations.push(Date.now() - started);
          if (this.durations.length > 500) this.durations.shift();
          done(r);
        };
        slot.worker.postMessage({ id: p.id, job: p.job });
      });
    }
  }

  run(job: CheckJob): Promise<JobResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ id: ++this.seq, job, resolve, reject });
      this.pump();
    });
  }

  /** Check one tile. A crashed or timed-out run fails every item (never throws). */
  async checkTile(tileId: TileId, variant: Variant, fragment: Fragment, teamName: string): Promise<CheckResult> {
    try {
      return (await this.run({ kind: "tile", tileId, variant, fragment, teamName })) as CheckResult;
    } catch {
      return failAll(tileId, variant);
    }
  }

  /** The publish check: every tile's suite on the composed page, no uncaught errors, and the change request. */
  async checkSite(fragments: Record<ScoredTileId, Fragment>, variants: Record<ScoredTileId, Variant>, teamName: string, crPhrase?: string): Promise<SiteCheck> {
    const tiles = await Promise.all(
      TILE_IDS.map(async (id) => {
        try {
          return (await this.run({ kind: "siteTile", tileId: id, variant: variants[id], fragments, teamName })) as CheckResult;
        } catch {
          return failAll(id, variants[id]);
        }
      }),
    );
    let page: PageResult;
    try {
      page = (await this.run({ kind: "sitePage", fragments, teamName, crPhrase })) as PageResult;
    } catch (e) {
      page = { errors: [e instanceof Error ? e.message : "the page did not load"], cr: crPhrase ? false : null };
    }
    const byId = Object.fromEntries(TILE_IDS.map((id, i) => [id, tiles[i]])) as Record<ScoredTileId, CheckResult>;
    const ok = tiles.every((r) => r.total > 0 && r.passed === r.total) && page.errors.length === 0;
    return { ok, tiles: byId, pageErrors: page.errors, changePassed: page.cr };
  }

  get busy() {
    return this.slots.filter((s) => s.busy).length + this.queue.length;
  }

  async close() {
    this.closed = true;
    for (const p of this.queue.splice(0)) p.reject(new Error("closed"));
    await Promise.all(this.slots.map((s) => s.worker.terminate().catch(() => 0)));
    this.slots = [];
  }
}

export function failAll(tileId: TileId, variant: Variant): CheckResult {
  const items = Object.fromEntries(checklist(tileId, variant).map((i) => [i.id, false]));
  return { items, passed: 0, total: Object.keys(items).length, at: Date.now() };
}
