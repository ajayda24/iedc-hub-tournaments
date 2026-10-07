import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COUNTDOWN_MS, DEFAULT_CONFIG, type EventConfig, type MeState } from "@iedc/shared";
import { Arena, type ArenaOutput } from "../src/arena";

function setup(cfg: Partial<EventConfig> = {}) {
  const sent = { me: new Map<string, MeState>(), kicked: [] as string[], feed: [] as string[] };
  const out: ArenaOutput = {
    state: () => {},
    me: (id, me) => sent.me.set(id, me),
    lb: () => {},
    feed: (f) => sent.feed.push(f.text),
    host: () => {},
    kicked: (id) => sent.kicked.push(id),
    log: () => {},
  };
  const arena = new Arena({ out });
  arena.setConfig({
    ...DEFAULT_CONFIG,
    rounds: [{ id: "r1", game: "anagram", difficulty: "easy", timeLimitSec: 60 }],
    ...cfg,
  });
  const join = (name: string, dept = "CSE") =>
    arena.join({ token: `tok-${name}-xxxxxxxx`, name, sem: "S3", dept, avatar: 1 }, `sock-${name}`, "192.168.137.10").me!;
  return { arena, sent, join };
}

/** Peek at the secret the way only the server can. */
const secretWords = (arena: Arena) => (arena.round!.secret as { words: string[] }).words;

describe("arena round lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs countdown → playing → results with speed-based scoring", () => {
    const { arena, join } = setup();
    const a = join("Anjali Nair");
    const b = join("Rahul K", "ECE");
    expect(arena.startRound().ok).toBe(true);
    expect(arena.phase).toBe("countdown");
    expect(arena.publicState().round!.pub).toBeNull(); // puzzle stays hidden during countdown

    // submissions before the round is live are refused
    expect(arena.submit(a.id, arena.round!.id, { index: 0, answer: "x" }).ok).toBe(false);

    vi.advanceTimersByTime(COUNTDOWN_MS);
    expect(arena.phase).toBe("playing");
    expect(arena.publicState().round!.pub).not.toBeNull();
    expect(JSON.stringify(arena.publicState())).not.toContain(secretWords(arena)[0] + '"'); // no answers leak

    const words = secretWords(arena);
    words.forEach((w, i) => arena.submit(a.id, arena.round!.id, { index: i, answer: w }) && vi.advanceTimersByTime(200));
    const pa = arena.players.get(a.id)!;
    expect(pa.solves).toBe(1);
    expect(pa.score).toBeGreaterThan(1500); // base + speed + first blood

    // b solves only one word, then time runs out → partial credit
    arena.submit(b.id, arena.round!.id, { index: 0, answer: words[0] });
    vi.advanceTimersByTime(61_000);
    expect(arena.phase).toBe("results");
    const pb = arena.players.get(b.id)!;
    expect(pb.score).toBe(Math.round(300 / words.length));
    expect(arena.publicState().round!.reveal).toEqual({ kind: "words", words });
    expect(arena.ranking()[0].id).toBe(a.id);
    expect(arena.toCsv()).toContain("Anjali Nair");
  });

  it("ends early once everybody is done", () => {
    const { arena, join } = setup();
    const a = join("Solo");
    arena.startRound();
    vi.advanceTimersByTime(COUNTDOWN_MS);
    secretWords(arena).forEach((w, i) => {
      arena.submit(a.id, arena.round!.id, { index: i, answer: w });
      vi.advanceTimersByTime(150);
    });
    vi.advanceTimersByTime(2000);
    expect(arena.phase).toBe("results");
  });

  it("applies the strike policy: warn, penalty, lock", () => {
    const { arena, join } = setup();
    const a = join("Sneaky");
    arena.startRound();
    vi.advanceTimersByTime(COUNTDOWN_MS);
    expect(arena.cheat(a.id, { kind: "focus", ms: 4000 }).action).toBe("warn");
    expect(arena.cheat(a.id, { kind: "focus", ms: 4000 }).action).toBe("penalty");
    expect(arena.players.get(a.id)!.score).toBe(-200);
    expect(arena.cheat(a.id, { kind: "focus", ms: 4000 }).action).toBe("lock");
    expect(arena.submit(a.id, arena.round!.id, { index: 0, answer: "x" }).error).toMatch(/Locked/);
    arena.unblock(a.id);
    vi.advanceTimersByTime(200);
    expect(arena.submit(a.id, arena.round!.id, { index: 0, answer: secretWords(arena)[0] }).ok).toBe(true);
  });

  it("blocks play while the device has internet, strikes once per round", () => {
    const { arena, join } = setup();
    const a = join("Googler");
    arena.startRound();
    vi.advanceTimersByTime(COUNTDOWN_MS);
    expect(arena.cheat(a.id, { kind: "internet" }).action).toBe("warn");
    expect(arena.cheat(a.id, { kind: "internet" }).action).toBe("noted");
    expect(arena.players.get(a.id)!.strikes).toBe(1);
    expect(arena.submit(a.id, arena.round!.id, { index: 0, answer: "x" }).error).toMatch(/mobile data/);
    arena.clearInternet(a.id);
    expect(arena.submit(a.id, arena.round!.id, { index: 0, answer: "x" }).ok).toBe(true);
  });

  it("knockout eliminates the bottom of the table", () => {
    const { arena, join } = setup({ format: "knockout", knockoutPct: 50 });
    const ps = ["A", "B", "C", "D"].map((n) => join(n));
    arena.startRound();
    vi.advanceTimersByTime(COUNTDOWN_MS);
    const words = secretWords(arena);
    // A and B solve one word each, C and D nothing
    arena.submit(ps[0].id, arena.round!.id, { index: 0, answer: words[0] });
    arena.submit(ps[1].id, arena.round!.id, { index: 1, answer: words[1] });
    arena.endRound();
    const out = [...arena.players.values()].filter((p) => p.eliminated).map((p) => p.name).sort();
    expect(out).toEqual(["C", "D"]);
  });

  it("rejoining with the same token keeps the score; duplicate names are refused", () => {
    const { arena, join } = setup();
    const a = join("Meera");
    arena.adjust(a.id, 50);
    const again = arena.join({ token: "tok-Meera-xxxxxxxx", name: "Meera", sem: "S3", dept: "CSE", avatar: 2 }, "sock-2", "x");
    expect(again.me!.score).toBe(50);
    expect(again.previousSocket).toBe("sock-Meera");
    const clash = arena.join({ token: "another-token-123", name: "meera", sem: "S1", dept: "CSE", avatar: 1 }, "s3", "x");
    expect(clash.ok).toBe(false);
  });

  it("restores a snapshot and closes a round that was live", () => {
    const { arena, join } = setup();
    join("Persisted");
    arena.startRound();
    vi.advanceTimersByTime(COUNTDOWN_MS);
    const snap = JSON.parse(JSON.stringify(arena.snapshot()));
    const { arena: fresh } = setup();
    fresh.restore(snap);
    expect(fresh.phase).toBe("results");
    expect(fresh.players.size).toBe(1);
  });
});
