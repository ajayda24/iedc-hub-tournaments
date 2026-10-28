import fs from "node:fs";
import type { ModelConfig } from "@iedc/shared/competitions/vibecoding/config";
import type { ModelHealthView } from "@iedc/shared/competitions/vibecoding/protocol";
import { ProviderError, type Provider } from "./gemini";
import { estimateTokens, type Prompt } from "./prompt";

export interface GatewayOptions {
  provider: Provider;
  models: ModelConfig[];
  maxInFlight?: number;
  timeoutMs?: number;
  maxOutputTokens?: number;
  /** pause a model this long after repeated errors */
  errorPauseMs?: number;
  errorsBeforePause?: number;
  /** extra attempts on the next model after a failed or malformed answer (free for the team) */
  retries?: number;
  now?: () => number;
  /** keeps today's request counts across restarts */
  usageFile?: string;
  /** when every model is out, fail waiting requests at once (live event) or wait for a paused model (quality tests) */
  failFast?: boolean;
}

export type CompleteResult<T> =
  | { ok: true; value: T; model: string; ms: number; attempts: number }
  | { ok: false; reason: string; attempts: number; noModel?: boolean };

interface ModelState {
  cfg: ModelConfig;
  disabled: boolean;
  pausedUntil: number;
  streak: number;
  errors: number[];
  lastError?: string;
  minute: number[];
  tokens: { at: number; n: number }[];
  inFlight: number;
}

interface Job {
  teamId: string;
  prompt: Prompt;
  tokens: number;
  accept: (text: string) => unknown;
  tried: string[];
  attempts: number;
  started: number;
  lastReason: string;
  resolve: (r: CompleteResult<unknown>) => void;
}

const MINUTE = 60_000;

/** The day Google's daily quotas count in: midnight Pacific (12:30 pm IST). */
export const quotaDay = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(t);

/**
 * One queue for every team's Asks (spec 12.2): fair round-robin across teams,
 * at most N in flight, each model kept under its RPM / input-TPM / daily
 * limits, failover down the chain, a pause after repeated errors.
 */
export class AiGateway {
  provider: Provider;
  private models: ModelState[] = [];
  private queues = new Map<string, Job[]>();
  private order: string[] = [];
  /** the team served last; the next turn starts after it */
  private lastTeam: string | null = null;
  private inFlight = 0;
  private wakeTimer: ReturnType<typeof setTimeout> | null = null;
  private now: () => number;
  private day: string;
  private dayCounts: Record<string, number> = {};
  private delivered: number[] = [];
  /** recent whole-request outcomes, newest last (true = an answer came back) */
  private outcomes: { at: number; ok: boolean }[] = [];
  private lastRealTry = 0;
  readonly opts: Required<Omit<GatewayOptions, "usageFile" | "now" | "provider" | "models">> & Pick<GatewayOptions, "usageFile">;

  constructor(o: GatewayOptions) {
    this.provider = o.provider;
    this.now = o.now ?? Date.now;
    this.opts = {
      maxInFlight: o.maxInFlight ?? 6,
      timeoutMs: o.timeoutMs ?? 45_000,
      maxOutputTokens: o.maxOutputTokens ?? 1200,
      errorPauseMs: o.errorPauseMs ?? 60_000,
      errorsBeforePause: o.errorsBeforePause ?? 3,
      retries: o.retries ?? 2,
      failFast: o.failFast ?? true,
      usageFile: o.usageFile,
    };
    this.day = quotaDay(this.now());
    this.loadUsage();
    this.setModels(o.models);
  }

  setModels(models: ModelConfig[]) {
    const old = new Map(this.models.map((m) => [m.cfg.id, m]));
    this.models = models.map((cfg) => old.get(cfg.id) ?? { cfg, disabled: false, pausedUntil: 0, streak: 0, errors: [], minute: [], tokens: [], inFlight: 0 });
    for (const m of this.models) m.cfg = models.find((c) => c.id === m.cfg.id)!;
  }

  setDisabled(id: string, disabled: boolean) {
    const m = this.models.find((x) => x.cfg.id === id);
    if (!m) return false;
    m.disabled = disabled;
    if (!disabled) {
      m.pausedUntil = 0;
      m.streak = 0;
    }
    this.pump();
    return true;
  }

  /* ---------------- limits ---------------- */

  private rollDay() {
    const d = quotaDay(this.now());
    if (d !== this.day) {
      this.day = d;
      this.dayCounts = {};
      this.saveUsage();
    }
  }

  private prune(m: ModelState) {
    const cut = this.now() - MINUTE;
    while (m.minute.length && m.minute[0] <= cut) m.minute.shift();
    while (m.tokens.length && m.tokens[0].at <= cut) m.tokens.shift();
    m.errors = m.errors.filter((t) => t > this.now() - 10 * MINUTE);
  }

  private usedToday = (m: ModelState) => this.dayCounts[m.cfg.id] ?? 0;

  /** Can this model take a request of `tokens` input tokens right now? */
  private canTake(m: ModelState, tokens: number): boolean {
    this.prune(m);
    if (m.disabled || m.pausedUntil > this.now()) return false;
    if (this.usedToday(m) >= m.cfg.rpd) return false;
    if (m.minute.length >= m.cfg.rpm) return false;
    const used = m.tokens.reduce((n, t) => n + t.n, 0);
    return used === 0 || used + tokens <= m.cfg.tpm;
  }

  /** Out for a while (not just busy this minute). */
  private outLong(m: ModelState) {
    return m.disabled || m.pausedUntil > this.now() || this.usedToday(m) >= m.cfg.rpd;
  }

  /** Primary models first, spread by least use this minute; overflow models only when no primary can take it. */
  private pick(job: Job): ModelState | null {
    const ok = this.models.filter((m) => this.canTake(m, job.tokens));
    const fresh = ok.filter((m) => !job.tried.includes(m.cfg.id));
    const pool = fresh.length ? fresh : ok;
    const primaries = pool.filter((m) => m.cfg.role === "primary").sort((a, b) => a.minute.length - b.minute.length);
    return primaries[0] ?? pool.find((m) => m.cfg.role === "overflow") ?? null;
  }

  /* ---------------- queue ---------------- */

  /**
   * Ask the AI. `accept` turns the text into a value, or returns null for a
   * malformed answer (retried on the next model, free for the team).
   */
  complete<T>(teamId: string, prompt: Prompt, accept: (text: string) => T | null): Promise<CompleteResult<T>> {
    this.lastRealTry = this.now();
    return new Promise((resolve) => {
      const job: Job = {
        teamId,
        prompt,
        tokens: estimateTokens(prompt),
        accept,
        tried: [],
        attempts: 0,
        started: this.now(),
        lastReason: "",
        resolve: resolve as (r: CompleteResult<unknown>) => void,
      };
      this.enqueue(job, false);
      this.pump();
    });
  }

  private enqueue(job: Job, front: boolean) {
    if (!this.queues.has(job.teamId)) {
      this.queues.set(job.teamId, []);
      this.order.push(job.teamId);
    }
    const q = this.queues.get(job.teamId)!;
    if (front) q.unshift(job);
    else q.push(job);
  }

  /** Next team (round-robin) that has a waiting job. */
  private nextTeam(): string | null {
    const start = this.lastTeam ? this.order.indexOf(this.lastTeam) + 1 : 0;
    for (let i = 0; i < this.order.length; i++) {
      const id = this.order[(start + i) % this.order.length];
      if (this.queues.get(id)?.length) return id;
    }
    return null;
  }

  get queued() {
    let n = 0;
    for (const q of this.queues.values()) n += q.length;
    return n;
  }

  get running() {
    return this.inFlight;
  }

  private pump() {
    this.rollDay();
    while (this.inFlight < this.opts.maxInFlight) {
      const teamId = this.nextTeam();
      if (!teamId) return;
      const q = this.queues.get(teamId)!;
      const job = q[0];
      const model = this.pick(job);
      if (!model) {
        const pausedOnly = this.models.filter((m) => !m.disabled && this.usedToday(m) < m.cfg.rpd && m.pausedUntil > this.now());
        if (!this.opts.failFast && pausedOnly.length) {
          this.wake(Math.max(500, Math.min(...pausedOnly.map((m) => m.pausedUntil)) - this.now()));
          return;
        }
        if (this.models.every((m) => this.outLong(m))) {
          // nothing will free up soon: fail everything waiting (the room falls back to Safe Mode)
          for (const qq of this.queues.values())
            for (const j of qq.splice(0)) {
              this.record(false);
              j.resolve({ ok: false, reason: j.lastReason || "no model available", attempts: j.attempts, noModel: true });
            }
          return;
        }
        // only rate-limited: try again shortly (order is kept)
        this.wake(500);
        return;
      }
      q.shift();
      this.lastTeam = teamId;
      void this.dispatch(job, model);
    }
  }

  private wake(ms: number) {
    if (this.wakeTimer) return;
    this.wakeTimer = setTimeout(() => {
      this.wakeTimer = null;
      this.pump();
    }, ms);
  }

  private async dispatch(job: Job, m: ModelState) {
    const now = this.now();
    this.inFlight++;
    m.inFlight++;
    m.minute.push(now);
    m.tokens.push({ at: now, n: job.tokens });
    this.dayCounts[m.cfg.id] = this.usedToday(m) + 1;
    this.saveUsage();
    job.attempts++;
    job.tried.push(m.cfg.id);
    let failure: string | null = null;
    let value: unknown = null;
    try {
      const reply = await this.provider.generate({ model: m.cfg.id, thinkingLevel: m.cfg.thinkingLevel, prompt: job.prompt, maxOutputTokens: this.opts.maxOutputTokens, timeoutMs: this.opts.timeoutMs });
      m.streak = 0;
      value = job.accept(reply.text);
      if (value == null) failure = "malformed answer";
    } catch (e) {
      const status = e instanceof ProviderError ? e.status : 0;
      failure = e instanceof Error ? e.message : String(e);
      m.lastError = failure.slice(0, 160);
      m.errors.push(this.now());
      if (status === 401 || status === 403) m.pausedUntil = this.now() + this.opts.errorPauseMs;
      else if (++m.streak >= this.opts.errorsBeforePause) {
        m.pausedUntil = this.now() + this.opts.errorPauseMs;
        m.streak = 0;
      }
    } finally {
      this.inFlight--;
      m.inFlight--;
    }
    if (!failure) {
      this.record(true);
      this.delivered.push(this.now());
      job.resolve({ ok: true, value, model: m.cfg.id, ms: this.now() - job.started, attempts: job.attempts });
    } else if (job.attempts <= this.opts.retries) {
      job.lastReason = failure;
      this.enqueue(job, true);
    } else {
      this.record(false);
      job.resolve({ ok: false, reason: failure, attempts: job.attempts });
    }
    this.pump();
  }

  private record(ok: boolean) {
    this.outcomes.push({ at: this.now(), ok });
    if (this.outcomes.length > 20) this.outcomes.shift();
  }

  /* ---------------- health ---------------- */

  /**
   * No model can answer: every model is out (disabled, paused, out of daily
   * quota), or the last 5 Asks all failed within 3 minutes.
   */
  down(): boolean {
    if (this.models.length === 0 || this.models.every((m) => this.outLong(m))) return true;
    const recent = this.outcomes.filter((o) => o.at > this.now() - 3 * MINUTE).slice(-5);
    return recent.length === 5 && recent.every((o) => !o.ok);
  }

  /** While down, still let one real request through every 30 s to notice recovery. */
  shouldTry(): boolean {
    return !this.down() || this.now() - this.lastRealTry > 30_000;
  }

  asksPerMin(): number {
    const cut = this.now() - MINUTE;
    this.delivered = this.delivered.filter((t) => t > cut);
    return this.delivered.length;
  }

  health(): ModelHealthView[] {
    this.rollDay();
    return this.models.map((m) => {
      this.prune(m);
      const status: ModelHealthView["status"] = m.disabled
        ? "disabled"
        : m.pausedUntil > this.now()
          ? "paused"
          : this.usedToday(m) >= m.cfg.rpd || m.minute.length >= m.cfg.rpm
            ? "limit"
            : m.inFlight > 0
              ? "busy"
              : "ok";
      return {
        id: m.cfg.id,
        label: m.cfg.label,
        role: m.cfg.role,
        status,
        usedToday: this.usedToday(m),
        rpd: m.cfg.rpd,
        lastMinute: m.minute.length,
        rpm: m.cfg.rpm,
        errors: m.errors.length,
        lastError: m.lastError,
      };
    });
  }

  /** Requests sent per model in the last minute, for tests and logs. */
  minuteCounts(): Record<string, number> {
    return Object.fromEntries(this.models.map((m) => (this.prune(m), [m.cfg.id, m.minute.length])));
  }

  private loadUsage() {
    if (!this.opts.usageFile) return;
    try {
      const u = JSON.parse(fs.readFileSync(this.opts.usageFile, "utf8")) as { day: string; counts: Record<string, number> };
      if (u.day === this.day) this.dayCounts = u.counts ?? {};
    } catch {
      /* first run */
    }
  }

  private saveUsage() {
    if (!this.opts.usageFile) return;
    try {
      fs.writeFileSync(this.opts.usageFile, JSON.stringify({ day: this.day, counts: this.dayCounts }));
    } catch {
      /* ignore */
    }
  }
}
