import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModelConfig } from "@iedc/shared/competitions/vibecoding/config";
import { parseAnswer } from "@iedc/shared/competitions/vibecoding/parser";
import { AiGateway, quotaDay } from "../src/competitions/vibecoding/ai/gateway";
import { ProviderError, type Provider, type ProviderRequest } from "../src/competitions/vibecoding/ai/gemini";
import { MockProvider } from "../src/competitions/vibecoding/ai/mock";
import { buildPrompt } from "../src/competitions/vibecoding/ai/prompt";
import { starterFragment } from "@iedc/shared/competitions/vibecoding/tiles/index";

const GOOD = "<html><p>ok</p></html><css></css><js></js>";
const model = (id: string, role: "primary" | "overflow", o: Partial<ModelConfig> = {}): ModelConfig => ({ id, label: id, role, rpm: 30, tpm: 16000, rpd: 14400, ...o });
const CHAIN = [model("g26", "primary"), model("g31", "primary"), model("fl31", "overflow", { rpm: 15, tpm: 250000, rpd: 500 }), model("fl35", "overflow", { rpm: 15, tpm: 250000, rpd: 500 })];
const prompt = (ask = "make it pretty") => buildPrompt({ tileId: "hero", variant: "full", fragment: starterFragment("hero", "full"), notes: "", teamName: "T", ask });
const accept = (t: string) => {
  const r = parseAnswer(t);
  return r.ok ? r : null;
};

/** A provider whose answers the test scripts, per call. */
class Scripted implements Provider {
  readonly name = "gemini" as const;
  calls: { model: string; at: number }[] = [];
  constructor(
    private answer: (req: ProviderRequest, n: number) => Promise<string> | string,
    private clock: () => number,
  ) {}
  async generate(req: ProviderRequest) {
    this.calls.push({ model: req.model, at: this.clock() });
    return { text: await this.answer(req, this.calls.length) };
  }
}

function setup(answer: (req: ProviderRequest, n: number) => Promise<string> | string, models = CHAIN, extra: Partial<ConstructorParameters<typeof AiGateway>[0]> = {}) {
  let t = Date.UTC(2026, 11, 15, 4, 0, 0);
  const now = () => t;
  const provider = new Scripted(answer, now);
  const gw = new AiGateway({ provider, models, now, ...extra });
  return { gw, provider, tick: (ms: number) => (t += ms), now };
}

afterEach(() => vi.useRealTimers());

describe("AI gateway (spec 12.2)", () => {
  it("answers through the first primary model", async () => {
    const { gw, provider } = setup(() => GOOD);
    const r = await gw.complete("t1", prompt(), accept);
    expect(r.ok).toBe(true);
    expect(r.ok && r.model).toBe("g26");
    expect(provider.calls).toHaveLength(1);
  });

  it("spreads load across the two Gemma models", async () => {
    const { gw, provider } = setup(() => GOOD);
    await Promise.all(["a", "b", "c", "d"].map((t) => gw.complete(t, prompt(), accept)));
    const used = provider.calls.map((c) => c.model);
    expect(used.filter((m) => m === "g26").length).toBe(2);
    expect(used.filter((m) => m === "g31").length).toBe(2);
  });

  it("a malformed answer is retried on the next model, free; after 2 retries it fails", async () => {
    const { gw, provider } = setup((_r, n) => (n === 1 ? "no code here" : GOOD));
    const r = await gw.complete("t1", prompt(), accept);
    expect(r.ok && r.attempts).toBe(2);
    expect(provider.calls.map((c) => c.model)).toEqual(["g26", "g31"]);

    const bad = setup(() => "never any code");
    const r2 = await bad.gw.complete("t1", prompt(), accept);
    expect(r2.ok).toBe(false);
    expect(r2.attempts).toBe(3);
  });

  it("fails over down the chain on 429/5xx/timeouts, overflow models last", async () => {
    const { gw, provider } = setup((req) => {
      if (req.model.startsWith("g")) throw new ProviderError("rate limited", 429);
      return GOOD;
    });
    const r = await gw.complete("t1", prompt(), accept);
    expect(r.ok && r.model).toBe("fl31");
    expect(provider.calls.map((c) => c.model)).toEqual(["g26", "g31", "fl31"]);
  });

  it("pauses a model for 60 s after 3 errors in a row", async () => {
    const { gw, tick } = setup((req) => {
      if (req.model === "g26") throw new ProviderError("boom", 503);
      return GOOD;
    }, [model("g26", "primary"), model("g31", "primary", { rpm: 1000 })]);
    for (let i = 0; i < 3; i++) await gw.complete(`t${i}`, prompt(), accept);
    expect(gw.health().find((m) => m.id === "g26")!.status).toBe("paused");
    tick(61_000);
    expect(gw.health().find((m) => m.id === "g26")!.status).not.toBe("paused");
  });

  it("never exceeds a model's RPM: extra requests wait for the next minute", async () => {
    vi.useFakeTimers();
    let t = 0;
    const provider = new Scripted(() => GOOD, () => t);
    const gw = new AiGateway({ provider, models: [model("only", "primary", { rpm: 3 })], now: () => t });
    const results = Promise.all([1, 2, 3, 4, 5].map((i) => gw.complete(`t${i}`, prompt(), accept)));
    await vi.advanceTimersByTimeAsync(10);
    expect(provider.calls).toHaveLength(3);
    t += 61_000;
    await vi.advanceTimersByTimeAsync(600);
    await results;
    expect(provider.calls).toHaveLength(5);
    expect(gw.minuteCounts().only).toBe(2);
  });

  it("keeps estimated input tokens under TPM", async () => {
    vi.useFakeTimers();
    let t = 0;
    const provider = new Scripted(() => GOOD, () => t);
    const tokens = Math.ceil((prompt().system.length + prompt().user.length) / 4);
    const gw = new AiGateway({ provider, models: [model("only", "primary", { tpm: tokens * 2 + 1 })], now: () => t });
    const all = Promise.all([1, 2, 3].map((i) => gw.complete(`t${i}`, prompt(), accept)));
    await vi.advanceTimersByTimeAsync(10);
    expect(provider.calls).toHaveLength(2);
    t += 61_000;
    await vi.advanceTimersByTimeAsync(600);
    await all;
    expect(provider.calls).toHaveLength(3);
  });

  it("respects the daily limit (days roll at midnight Pacific) and fails fast when every model is out", async () => {
    const { gw } = setup(() => GOOD, [model("tiny", "primary", { rpd: 2 })]);
    expect((await gw.complete("a", prompt(), accept)).ok).toBe(true);
    expect((await gw.complete("b", prompt(), accept)).ok).toBe(true);
    const r = await gw.complete("c", prompt(), accept);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.noModel).toBe(true);
    expect(gw.down()).toBe(true);
    expect(quotaDay(Date.UTC(2026, 11, 15, 7, 59))).toBe("2026-12-14");
    expect(quotaDay(Date.UTC(2026, 11, 15, 8, 1))).toBe("2026-12-15");
  });

  it("is fair: teams take turns (round-robin), max N in flight", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let t = 0;
    const provider = new Scripted(async () => {
      await gate;
      return GOOD;
    }, () => t);
    const gw = new AiGateway({ provider, models: [model("m", "primary", { rpm: 1000, tpm: 10_000_000 })], maxInFlight: 1, now: () => t });
    const done: string[] = [];
    const jobs = [
      ["A", 1],
      ["A", 2],
      ["A", 3],
      ["B", 1],
      ["C", 1],
    ].map(([team, n]) => gw.complete(String(team), prompt(`${team}${n}`), accept).then(() => done.push(`${team}${n}`)));
    await vi.advanceTimersByTimeAsync(1);
    expect(gw.running).toBe(1);
    expect(gw.queued).toBe(4);
    release();
    await vi.advanceTimersByTimeAsync(10);
    await Promise.all(jobs);
    // A went first; then B and C get their turn before A's second request
    expect(done).toEqual(["A1", "B1", "C1", "A2", "A3"]);
  });

  it("disabling a model takes it out of the chain", async () => {
    const { gw, provider } = setup(() => GOOD);
    gw.setDisabled("g26", true);
    await gw.complete("t", prompt(), accept);
    expect(provider.calls[0].model).toBe("g31");
    expect(gw.health().find((m) => m.id === "g26")!.status).toBe("disabled");
  });

  it("goes down after 5 failed Asks in a row, and lets one real try through every 30 s", async () => {
    const { gw, tick } = setup(() => {
      throw new ProviderError("down", 503);
    }, [model("m", "primary", { rpm: 1000 })], { errorsBeforePause: 1000 });
    for (let i = 0; i < 5; i++) await gw.complete(`t${i}`, prompt(), accept);
    expect(gw.down()).toBe(true);
    expect(gw.shouldTry()).toBe(false);
    tick(31_000);
    expect(gw.shouldTry()).toBe(true);
  });

  it("the mock provider answers with real fragments, sometimes fails", async () => {
    const mock = new MockProvider({ latencyMs: [1, 2], failRate: 0, badRate: 0, quality: 1 });
    const gw = new AiGateway({ provider: mock, models: CHAIN });
    const r = await gw.complete("t", prompt(), accept);
    expect(r.ok && r.value?.fragment.html).toContain("IEDC Fest 2026");
    const flaky = new AiGateway({ provider: new MockProvider({ latencyMs: [1, 2], failRate: 1 }), models: CHAIN, errorsBeforePause: 1000 });
    expect((await flaky.complete("t", prompt(), accept)).ok).toBe(false);
  });

  it("gives up on a request after the timeout", async () => {
    const mock = new MockProvider({ latencyMs: [5000, 5000] });
    const gw = new AiGateway({ provider: mock, models: [model("m", "primary")], timeoutMs: 20, retries: 0 });
    const r = await gw.complete("t", prompt(), accept);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe("timeout");
  });
});

describe("prompt (spec 6.2)", () => {
  it("has the hooks and the team's notes but never the checklist", () => {
    const p = buildPrompt({ tileId: "countdown", variant: "full", fragment: starterFragment("countdown", "full"), notes: "Purple and playful", teamName: "Byte Me", ask: "hi" });
    expect(p.system).toContain('data-hook="cd-days"');
    expect(p.system).toContain("Purple and playful");
    expect(p.system).toContain("2026-12-15T09:00:00+05:30");
    expect(p.system).not.toContain("It updates every second");
    expect(p.user).toBe("hi");
    const simple = buildPrompt({ tileId: "countdown", variant: "simple", fragment: starterFragment("countdown", "simple"), notes: "", teamName: "X", ask: "hi" });
    expect(simple.system).not.toContain("cd-seconds");
    expect(simple.system).toContain("Project Notes from the team: (none)");
    expect(buildPrompt({ tileId: "hero", variant: "full", fragment: starterFragment("hero", "full"), notes: "", teamName: "X", ask: "hi", changeRequest: true }).system).toContain("cr-banner");
  });
});
