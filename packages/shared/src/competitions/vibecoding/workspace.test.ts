import { describe, expect, it } from "vitest";
import { applyAction, GLITCH_FRAGMENT, LIMITS, type Action } from "./rules";
import { createState, type CompetitionState, type Fragment } from "./state";

const T0 = Date.UTC(2026, 11, 1, 5, 0, 0);
const MIN = 60_000;
const f = (html: string): Fragment => ({ html, css: "", js: "" });
const allPass = (ids: string[]) => ({ items: Object.fromEntries(ids.map((i) => [i, true])), passed: ids.length, total: ids.length, at: 0 });

/** A team of A1+A2 in BUILD, clock started at T0. */
function building(opts: { glitch?: boolean } = {}) {
  const s = createState(7, T0);
  let now = T0;
  const go = (a: Action) => applyAction(s, a, { now });
  const at = (ms: number) => (now = T0 + ms);
  go({ type: "phase:set", phase: "registration" });
  for (const id of ["A1", "A2", "B1"]) go({ type: "person:join", person: { studentId: id, name: id, dept: "CSE", sem: "S3", avatar: 1 } });
  const teamId = go({ type: "team:create", studentId: "A1", name: "Alpha" }).teamId!;
  go({ type: "team:join", studentId: "A2", code: s.teams[teamId].code });
  go({ type: "settings", patch: { glitch: opts.glitch ?? false } });
  go({ type: "phase:set", phase: "build" });
  const t = () => s.teams[teamId];
  /** open + ask + deliver, as the room does */
  const ask = (tileId: "hero" | "gallery" = "hero", html = "<p>v</p>", who = "A1", queued = 0) => {
    go({ type: "tile:open", studentId: who, tileId });
    const b = go({ type: "ask:begin", studentId: who, tileId });
    if (!b.ok) return b;
    return go({ type: "ask:deliver", teamId, tileId, fragment: f(html), queued });
  };
  return { s, go, at, t, teamId, ask };
}

describe("workspace (spec 7)", () => {
  it("Save Point: up to 10 per tile, labelled, marks the Save Point habit", () => {
    const { go, t } = building();
    go({ type: "tile:open", studentId: "A1", tileId: "hero" });
    for (let i = 0; i < LIMITS.saveMax; i++) expect(go({ type: "save:create", studentId: "A1", tileId: "hero" }).ok).toBe(true);
    expect(go({ type: "save:create", studentId: "A1", tileId: "hero" }).error).toMatch(/10 Save Points/);
    expect(t().tiles.hero.saves.map((x) => x.label).slice(0, 2)).toEqual(["Save Point 1", "Save Point 2"]);
    expect(t().tiles.hero.savedBeforePass).toBe(true);
  });

  it("every delivered answer takes an auto-save first; only the last 5 are kept", () => {
    const { at, t, ask } = building();
    for (let i = 1; i <= 7; i++) {
      at(i * 2 * MIN);
      expect(ask("hero", `<p>v${i}</p>`).ok).toBe(true);
    }
    expect(t().tiles.hero.autos).toHaveLength(LIMITS.autoKeep);
    expect(t().tiles.hero.autos.at(-1)!.fragment.html).toBe("<p>v6</p>");
    expect(t().tiles.hero.fragment.html).toBe("<p>v7</p>");
  });

  it("Go Back restores a Save Point, and is itself reversible", () => {
    const { go, at, t, ask } = building();
    ask("hero", "<p>good</p>");
    go({ type: "save:create", studentId: "A1", tileId: "hero", note: "works" });
    const saveId = t().tiles.hero.saves[0].id;
    at(2 * MIN);
    ask("hero", "<p>broken</p>");
    expect(go({ type: "save:restore", studentId: "A1", tileId: "hero", saveId }).ok).toBe(true);
    expect(t().tiles.hero.fragment.html).toBe("<p>good</p>");
    expect(t().tiles.hero.usedGoBack).toBe(true);
    // the state before Go Back is now an auto-save: go back to it
    const undo = t().tiles.hero.autos.at(-1)!;
    expect(undo.fragment.html).toBe("<p>broken</p>");
    go({ type: "save:restore", studentId: "A1", tileId: "hero", saveId: undo.id });
    expect(t().tiles.hero.fragment.html).toBe("<p>broken</p>");
  });

  it("Clean Rewind: Go Back, then that tile passes", () => {
    const { go, t, ask } = building();
    ask("hero", "<p>a</p>");
    go({ type: "save:create", studentId: "A1", tileId: "hero" });
    go({ type: "save:restore", studentId: "A1", tileId: "hero", saveId: t().tiles.hero.saves[0].id });
    go({ type: "check:result", teamId: t().id, tileId: "hero", result: allPass(["title", "tagline", "gradient", "cta"]) });
    expect(t().tiles.hero.doneAt).not.toBeNull();
    expect(t().cleanRewind).toBe(true);
  });

  it("cooldown: 40 s + 5 s per queued request, capped at 90 s, shared by the team", () => {
    const { go, at, t, ask } = building();
    ask("hero", "<p>x</p>", "A1", 2);
    expect(t().cooldownUntil).toBe(T0 + 50_000);
    at(10_000);
    go({ type: "tile:open", studentId: "A2", tileId: "gallery" });
    expect(go({ type: "ask:begin", studentId: "A2", tileId: "gallery" }).error).toMatch(/wait 40s/);
    at(60_000);
    ask("hero", "<p>y</p>", "A1", 50);
    expect(t().cooldownUntil).toBe(T0 + 60_000 + 90_000);
  });

  it("one Ask in flight per team; 60 delivered Asks max; failures are free", () => {
    const { go, at, t } = building();
    go({ type: "tile:open", studentId: "A1", tileId: "hero" });
    go({ type: "ask:begin", studentId: "A1", tileId: "hero" });
    go({ type: "tile:open", studentId: "A2", tileId: "gallery" });
    expect(go({ type: "ask:begin", studentId: "A2", tileId: "gallery" }).error).toMatch(/already thinking/);
    go({ type: "ask:fail", teamId: t().id });
    expect(t().asksUsed).toBe(0);
    expect(t().cooldownUntil).toBe(0);
    t().asksUsed = LIMITS.askCap;
    at(1000);
    expect(go({ type: "ask:begin", studentId: "A2", tileId: "gallery" }).error).toMatch(/all its Asks/);
  });

  it("a tile is held by one member at a time; idle holders are released after 3 min", () => {
    const { go, at, t } = building();
    expect(go({ type: "tile:open", studentId: "A1", tileId: "hero" }).ok).toBe(true);
    expect(go({ type: "tile:open", studentId: "A2", tileId: "hero" }).error).toMatch(/A1 is working/);
    expect(go({ type: "ask:begin", studentId: "A2", tileId: "hero" }).error).toMatch(/A1 is working/);
    // members work in parallel on different tiles
    expect(go({ type: "tile:open", studentId: "A2", tileId: "gallery" }).ok).toBe(true);
    at(3 * MIN + 1000);
    go({ type: "tick" });
    expect(t().tiles.hero.holder).toBeNull();
    expect(go({ type: "tile:open", studentId: "A2", tileId: "hero" }).ok).toBe(true);
    // opening another tile releases the first
    expect(t().tiles.gallery.holder).toBeNull();
  });

  it("pause blocks Asks; resume shifts the cooldown; freeze blocks everything", () => {
    const { go, at, t, ask } = building();
    ask("hero");
    const cd = t().cooldownUntil;
    at(5000);
    go({ type: "clock:pause" });
    expect(go({ type: "ask:begin", studentId: "A1", tileId: "hero" }).error).toMatch(/paused/);
    at(65_000);
    go({ type: "clock:resume" });
    expect(t().cooldownUntil).toBe(cd + 60_000);
    go({ type: "phase:set", phase: "frozen" });
    expect(go({ type: "tile:open", studentId: "A1", tileId: "hero" }).error).toMatch(/frozen/);
    expect(go({ type: "save:create", studentId: "A1", tileId: "hero" }).error).toMatch(/frozen/);
  });

  it("hints: 3 per tile, returned in order", () => {
    const { go } = building();
    const h = [1, 2, 3].map(() => go({ type: "hint:use", studentId: "A1", tileId: "hero" }).hint);
    expect(h[0]).toMatch(/heading, the tagline/);
    expect(h[1]).toMatch(/Name each part/);
    expect(go({ type: "hint:use", studentId: "A1", tileId: "hero" }).error).toMatch(/No hints/);
  });

  it("Show me: only after 12 minutes on the tile, 2 per team, completes the tile", () => {
    const { go, at, t } = building();
    go({ type: "tile:open", studentId: "A1", tileId: "hero" });
    const ref = f("<h1>ref</h1>");
    const res = allPass(["title"]);
    expect(go({ type: "autosolve:use", studentId: "A1", tileId: "hero", reference: ref, result: res }).error).toMatch(/12 minutes/);
    at(12 * MIN);
    expect(go({ type: "autosolve:use", studentId: "A1", tileId: "hero", reference: ref, result: res }).ok).toBe(true);
    expect(t().tiles.hero.autoSolved).toBe(true);
    expect(t().tiles.hero.doneAt).toBe(12 * MIN);
    go({ type: "tile:open", studentId: "A1", tileId: "gallery" });
    at(24 * MIN);
    go({ type: "autosolve:use", studentId: "A1", tileId: "gallery", reference: ref, result: res });
    go({ type: "tile:open", studentId: "A1", tileId: "schedule" } as Action);
    at(36 * MIN);
    expect(go({ type: "autosolve:use", studentId: "A1", tileId: "schedule", reference: ref, result: res }).error).toMatch(/both/);
  });

  it("glitch: once per team, minute 50–70, free; the host can fire or cancel it", () => {
    const { at, t, ask, go } = building({ glitch: true });
    const when = t().glitch.at;
    at(when - 1000);
    expect(ask("hero").glitched).toBeFalsy();
    at(when + 5 * MIN);
    const used = t().asksUsed;
    const r = ask("hero", "<p>real</p>");
    expect(r.glitched).toBe(true);
    expect(t().tiles.hero.fragment).toEqual(GLITCH_FRAGMENT);
    expect(t().asksUsed).toBe(used);
    at(when + 10 * MIN);
    expect(ask("hero").glitched).toBeFalsy();

    const other = building({ glitch: true });
    other.go({ type: "host:glitch", teamId: other.teamId, fire: true });
    expect(other.ask("hero").glitched).toBe(true);
    const third = building({ glitch: true });
    third.go({ type: "host:glitch", teamId: third.teamId, fire: false });
    third.at(third.t().glitch.at + 1000);
    expect(third.ask("hero").glitched).toBeFalsy();
    expect(go({ type: "host:glitch", teamId: t().id, fire: true }).ok).toBe(false);
  });

  it("first tile to pass gets First Blood; 8 tiles unlock the puzzle; notes bonus decided at the 4th", () => {
    const { s, go, at, t } = building();
    go({ type: "notes:update", studentId: "A1", notes: "Our page is bright purple and playful with big rounded cards and friendly emoji everywhere please" });
    const ids = ["hero", "countdown", "schedule", "register", "theme", "gallery", "feedback", "fixit"] as const;
    ids.forEach((id, i) => {
      at((i + 1) * MIN);
      go({ type: "check:result", teamId: t().id, tileId: id, result: allPass(["x"]) });
    });
    expect(s.firstTileBy).toBe(t().id);
    expect(t().notesBonus).toBe(true);
    expect(t().stage).toBe("puzzle");
    expect(t().puzzle!.optimal).toBeGreaterThanOrEqual(8);
  });
});

describe("state after a host reset", () => {
  it("keeps the members, clears progress", () => {
    const { s, go, t, ask } = building();
    ask("hero");
    go({ type: "host:resetTeam", teamId: t().id });
    expect(t().members).toHaveLength(2);
    expect(t().asksUsed).toBe(0);
    expect(t().stage).toBe("tiles");
    expect((s as CompetitionState).teams[t().id].tiles.hero.autos).toHaveLength(0);
  });
});
