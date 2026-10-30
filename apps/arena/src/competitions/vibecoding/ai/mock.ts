import { TILES, referenceFragment } from "@iedc/shared/competitions/vibecoding/tiles/index";
import { TASKS } from "@iedc/shared/competitions/vibecoding/config";
import type { Fragment } from "@iedc/shared/competitions/vibecoding/state";
import { ProviderError, type Provider, type ProviderReply, type ProviderRequest } from "./gemini";

export interface MockOptions {
  /** answer time range in ms (spec: 2–25 s) */
  latencyMs?: [number, number];
  /** share of requests that fail like a 503 (spec: 3%) */
  failRate?: number;
  /** share of answers that come back malformed (spec: 1%) */
  badRate?: number;
  /** share of good answers that are the tile's reference (the rest are a "bad" fragment) */
  quality?: number;
  random?: () => number;
}

/**
 * A pretend AI for development, tests and load tests: no quota spent. It
 * answers with the tile's reference fragment (or a known-bad one), after a
 * realistic delay, and sometimes fails or rambles.
 */
export class MockProvider implements Provider {
  readonly name = "mock" as const;
  private rnd: () => number;
  calls = 0;

  constructor(private opts: MockOptions = {}) {
    this.rnd = opts.random ?? Math.random;
  }

  async generate(req: ProviderRequest): Promise<ProviderReply> {
    this.calls++;
    const [lo, hi] = this.opts.latencyMs ?? [2000, 25000];
    const wait = lo + this.rnd() * (hi - lo);
    if (wait > req.timeoutMs) {
      await sleep(req.timeoutMs);
      throw new ProviderError("timeout", 0);
    }
    await sleep(wait);
    if (this.rnd() < (this.opts.failRate ?? 0.03)) throw new ProviderError("mock: model overloaded", 503);
    if (this.rnd() < (this.opts.badRate ?? 0.01)) return { text: "Sure! Here's a great section for you 🙂 (no code, oops)" };
    const { tileId, teamName } = req.prompt;
    let f: Fragment = referenceFragment(tileId, "full", teamName);
    if (this.rnd() >= (this.opts.quality ?? 0.85)) {
      const bad = TILES[tileId].bad.filter((b) => (b.variant ?? "full") === "full");
      if (bad.length) f = bad[Math.floor(this.rnd() * bad.length)].fragment;
    }
    // the client's change request: add the banner when the Ask quotes the phrase
    const cr = req.prompt.system.includes('data-hook="cr-banner"') ? TASKS.changeRequests.find((c) => req.prompt.user.toLowerCase().includes(c.phrase.toLowerCase())) : undefined;
    const html = cr ? `${f.html}\n<p data-hook="cr-banner">${cr.phrase}</p>` : f.html;
    return { text: `Done! Bulbu built it for you.\n<html>${html}</html>\n<css>${f.css}</css>\n<js>${f.js}</js>` };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mock settings from the environment (VC_MOCK_LATENCY_MS=100-300, VC_MOCK_FAIL, VC_MOCK_BAD, VC_MOCK_QUALITY). */
export function mockOptionsFromEnv(env = process.env): MockOptions {
  const lat = env.VC_MOCK_LATENCY_MS?.match(/^(\d+)-(\d+)$/);
  const num = (v: string | undefined) => (v != null && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : undefined);
  return {
    latencyMs: lat ? [Number(lat[1]), Number(lat[2])] : undefined,
    failRate: num(env.VC_MOCK_FAIL),
    badRate: num(env.VC_MOCK_BAD),
    quality: num(env.VC_MOCK_QUALITY),
  };
}
