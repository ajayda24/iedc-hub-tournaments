import { afterEach, describe, expect, it } from "vitest";
import { EVC, type AskAck, type TeamView } from "@iedc/shared/competitions/vibecoding/protocol";
import { joinPayload, next, startServer } from "./competitions.test";
import type { RoomDeps } from "../src/competitions/vibecoding/room";

let srv: Awaited<ReturnType<typeof startServer>> | null = null;
afterEach(async () => {
  await srv?.close();
  srv = null;
});

/** Host + a 2-member team, in BUILD. */
async function team(room: Partial<RoomDeps> = {}) {
  srv = await startServer(undefined, room);
  const host = await srv.client("host", { pin: "2468" });
  await host.s.emitWithAck(EVC.hostPhase, { phase: "registration" });
  await host.s.emitWithAck(EVC.hostSettings, { glitch: false });
  const a = await srv.client("player", { token: "tok-A1-xxxxxxxx" });
  await a.s.emitWithAck(EVC.join, joinPayload("A1", "Asha"));
  await a.s.emitWithAck(EVC.teamCreate, { name: "Byte Me" });
  const code = Object.values(srv.room.state.teams)[0].code;
  const b = await srv.client("player", { token: "tok-B1-xxxxxxxx" });
  await b.s.emitWithAck(EVC.join, joinPayload("B1", "Binu"));
  await b.s.emitWithAck(EVC.teamJoin, { code });
  await host.s.emitWithAck(EVC.hostPhase, { phase: "build" });
  const t = () => Object.values(srv!.room.state.teams)[0];
  return { host, a: a.s, b: b.s, t };
}

describe("Ask flow (mock AI)", () => {
  it("an Ask installs the answer, checks it and completes the tile", async () => {
    const { a, t } = await team();
    expect((await a.emitWithAck(EVC.tileOpen, { tileId: "hero" })).ok).toBe(true);
    const done = next<TeamView>(a, EVC.team, (v) => v?.tiles.find((x) => x.id === "hero")?.done === true, 20_000);
    const r: AskAck = await a.timeout(10_000).emitWithAck(EVC.askSend, { tileId: "hero", text: "make the hero banner" });
    expect(r.ok).toBe(true);
    expect(r.check!.passed).toBe(r.check!.total);
    const view = await done;
    expect(view.asksUsed).toBe(1);
    expect(view.cooldownUntil).toBeGreaterThan(Date.now());
    expect(t().tiles.hero.doneAt).not.toBeNull();
    expect(view.tiles.find((x) => x.id === "hero")!.piece).toBeGreaterThan(0);
  });

  it("the cooldown blocks the next Ask for the whole team; members work in parallel", async () => {
    const { a, b } = await team();
    await a.emitWithAck(EVC.tileOpen, { tileId: "hero" });
    await b.emitWithAck(EVC.tileOpen, { tileId: "gallery" });
    expect((await a.timeout(10_000).emitWithAck(EVC.askSend, { tileId: "hero", text: "x" })).ok).toBe(true);
    const r = await b.timeout(10_000).emitWithAck(EVC.askSend, { tileId: "gallery", text: "y" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/wait \d+s/);
    // B can't Ask on A's tile either
    expect((await b.emitWithAck(EVC.tileOpen, { tileId: "hero" })).error).toMatch(/Asha is working/);
  });

  it("malformed answers are retried and, if all fail, the Ask is free", async () => {
    const { a, t } = await team({ mock: { latencyMs: [2, 5], failRate: 0, badRate: 1 } });
    await a.emitWithAck(EVC.tileOpen, { tileId: "hero" });
    const r = await a.timeout(10_000).emitWithAck(EVC.askSend, { tileId: "hero", text: "x" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/wasn't counted/);
    expect(t().asksUsed).toBe(0);
    expect(t().cooldownUntil).toBe(0);
    expect(t().askPending).toBeNull();
  });

  it("a phone with internet can't Ask", async () => {
    const { a } = await team();
    await a.emitWithAck(EVC.tileOpen, { tileId: "hero" });
    a.emit(EVC.internet, { online: true });
    await new Promise((r) => setTimeout(r, 50));
    expect((await a.emitWithAck(EVC.askSend, { tileId: "hero", text: "x" })).error).toMatch(/internet/);
    a.emit(EVC.internet, { online: false });
    await new Promise((r) => setTimeout(r, 50));
    expect((await a.timeout(10_000).emitWithAck(EVC.askSend, { tileId: "hero", text: "x" })).ok).toBe(true);
  });

  it("Safe Mode (manual) answers with Bulbu's backup", async () => {
    const { a, host } = await team();
    await host.s.emitWithAck(EVC.hostSettings, { safeMode: true });
    await a.emitWithAck(EVC.tileOpen, { tileId: "countdown" });
    const r: AskAck = await a.timeout(10_000).emitWithAck(EVC.askSend, { tileId: "countdown", text: "x" });
    expect(r.backup).toBe(true);
    expect(r.check!.passed).toBe(r.check!.total);
  });

  it("Safe Mode switches on by itself when no model answers", async () => {
    const { a, b, host } = await team({ mock: { latencyMs: [1, 2], failRate: 1, badRate: 0 } });
    // every model gets paused after repeated failures: the gateway is down
    for (const m of srv!.room.gateway.health()) await host.s.emitWithAck(EVC.hostModel, { id: m.id, disabled: true });
    await a.emitWithAck(EVC.tileOpen, { tileId: "hero" });
    const r: AskAck = await a.timeout(10_000).emitWithAck(EVC.askSend, { tileId: "hero", text: "x" });
    expect(r.ok).toBe(true);
    expect(r.backup).toBe(true);
    expect(srv!.room.health().autoSafe).toBe(true);
    void b;
  });

  it("Check, Save Point, Go Back (re-checked), hints, Show me guard", async () => {
    const { a, t } = await team();
    await a.emitWithAck(EVC.tileOpen, { tileId: "fixit" });
    const c = await a.timeout(10_000).emitWithAck(EVC.checkRun, { tileId: "fixit" });
    expect(c.ok).toBe(true);
    expect(c.check.items).toEqual({ like: false, empty: false, valid: true, intact: true });
    expect((await a.emitWithAck(EVC.checkRun, { tileId: "fixit" })).error).toMatch(/few seconds/);
    expect((await a.emitWithAck(EVC.saveCreate, { tileId: "fixit", note: "buggy start" })).ok).toBe(true);
    await a.timeout(10_000).emitWithAck(EVC.askSend, { tileId: "fixit", text: "fix the bugs" });
    expect(t().tiles.fixit.doneAt).not.toBeNull();
    const back = await a.timeout(10_000).emitWithAck(EVC.saveRestore, { tileId: "fixit", saveId: t().tiles.fixit.saves[0].id });
    expect(back.ok).toBe(true);
    expect(t().tiles.fixit.lastCheck!.items.like).toBe(false);
    expect(t().tiles.fixit.doneAt).not.toBeNull(); // a done tile stays done
    expect((await a.emitWithAck(EVC.hintUse, { tileId: "fixit" })).hint).toMatch(/going wrong/);
    expect((await a.emitWithAck(EVC.autosolveUse, { tileId: "gallery" })).error).toMatch(/12 minutes/);
  });
});

describe("crash recovery mid-build (spec 16.3)", () => {
  it("restores teams, tiles, Save Points, the clock and cooldowns; frees a stuck Ask", async () => {
    const { a, t } = await team();
    await a.emitWithAck(EVC.tileOpen, { tileId: "hero" });
    await a.timeout(10_000).emitWithAck(EVC.askSend, { tileId: "hero", text: "x" });
    await a.emitWithAck(EVC.saveCreate, { tileId: "hero", note: "good" });
    await a.emitWithAck(EVC.notesUpdate, { notes: "purple and playful" });
    const before = JSON.parse(JSON.stringify(t()));
    const clock = { ...srv!.room.state.clock };
    srv!.room.state.teams[before.id].askPending = { tileId: "gallery", by: "A1", since: Date.now() };
    srv!.room.state.version++;
    const dir = srv!.dataDir;
    await srv!.close();

    srv = await startServer(dir);
    expect(srv.room.wasRestored).toBe(true);
    expect(srv.room.state.phase).toBe("build");
    expect(srv.room.state.clock).toEqual(clock);
    const after = srv.room.state.teams[before.id];
    expect(after.tiles.hero.doneAt).toBe(before.tiles.hero.doneAt);
    expect(after.tiles.hero.saves[0].note).toBe("good");
    expect(after.cooldownUntil).toBe(before.cooldownUntil);
    expect(after.notes).toBe("purple and playful");
    expect(after.askPending).toBeNull();
    // the phone comes straight back by its device token
    const back = await srv.client("player", { token: "tok-A1-xxxxxxxx" });
    expect(back.hello.me?.teamId).toBe(before.id);
  });
});

describe("editing the code by hand", () => {
  it("is free, auto-saved, checked, filtered for safety, and the host can switch it off", async () => {
    const { a, b, host, t } = await team();
    await a.emitWithAck(EVC.tileOpen, { tileId: "hero" });
    const ref = srv!.room.state.teams[t().id].tiles.hero.fragment;
    expect(ref.html).toBe("");
    // B can't edit A's tile
    expect((await b.emitWithAck(EVC.codeEdit, { tileId: "hero", html: "<p>x</p>", css: "", js: "" })).error).toMatch(/Asha is working/);
    // unsafe code is refused
    const bad = await a.emitWithAck(EVC.codeEdit, { tileId: "hero", html: '<img src="https://x.y/a.png">', css: "", js: "" });
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatch(/external link/);
    // a correct hand-written hero passes and completes the tile, without using an Ask
    const html = '<h1 data-hook="hero-title">IEDC Fest 2026</h1><p data-hook="hero-tagline">Build. Break. Launch.</p><a data-hook="hero-cta" href="#register">Register now</a>';
    const r = await a.timeout(10_000).emitWithAck(EVC.codeEdit, { tileId: "hero", html, css: "#tile-hero{background:linear-gradient(red,blue)}", js: "" });
    expect(r.ok).toBe(true);
    expect(r.done).toBe(true);
    expect(t().asksUsed).toBe(0);
    expect(t().cooldownUntil).toBe(0);
    expect(t().tiles.hero.edits).toBe(1);
    expect(t().tiles.hero.autos).toHaveLength(1);
    // switched off by the host
    await host.s.emitWithAck(EVC.hostSettings, { allowCodeEdit: false });
    expect((await a.emitWithAck(EVC.codeEdit, { tileId: "hero", html: "<p>y</p>", css: "", js: "" })).error).toMatch(/switched off/);
  });
});
