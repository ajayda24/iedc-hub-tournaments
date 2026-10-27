import { describe, expect, it } from "vitest";
import { COMPETITIONS, COMPETITION_IDS, isCompetitionId } from "../registry";
import { vibecoding } from "./index";
import { applyAction, type Action } from "./rules";
import { cHelloSchema, teamCreateSchema, teamJoinSchema, askSchema, hostSettingsSchema } from "./schemas";
import { createState, type CompetitionState } from "./state";
import { checklist, hooksFor, TILE_IDS } from "./config";

const T0 = Date.UTC(2026, 11, 1, 5, 0, 0);
const person = (id: string, name = id) => ({ studentId: id, name, dept: "CSE", sem: "S3", avatar: 1 });

function fresh(phase: CompetitionState["phase"] = "registration") {
  const s = createState(42, T0);
  const go = (a: Action, now = T0) => applyAction(s, a, { now });
  if (phase !== "setup") go({ type: "phase:set", phase: "registration" });
  if (phase === "warmup" || phase === "build") go({ type: "phase:set", phase });
  for (const id of ["A1", "A2", "A3", "A4", "A5", "B1"]) go({ type: "person:join", person: person(id) });
  return { s, go };
}

describe("registry and contract", () => {
  it("knows the vibecoding competition", () => {
    expect(COMPETITION_IDS).toEqual(["vibecoding"]);
    expect(isCompetitionId("vibecoding")).toBe(true);
    expect(isCompetitionId("constructor")).toBe(false);
    expect(COMPETITIONS.vibecoding.title).toBe("Tile Rush");
    expect(vibecoding.meta.id).toBe("vibecoding");
  });

  it("creates a fresh state in SETUP", () => {
    const s = vibecoding.createState(1, T0);
    expect(s.phase).toBe("setup");
    expect(s.clock.durationMs).toBe(100 * 60_000);
  });

  it("team state: shuffled board and pieces, deterministic per seed", () => {
    const a = vibecoding.createTeamState(7, { id: "t1", name: "X", code: "ABCD", captain: "A1", createdAt: T0 });
    const b = vibecoding.createTeamState(7, { id: "t1", name: "X", code: "ABCD", captain: "A1", createdAt: T0 });
    const c = vibecoding.createTeamState(8, { id: "t1", name: "X", code: "ABCD", captain: "A1", createdAt: T0 });
    expect(a.order).toEqual(b.order);
    expect(a.perm).toEqual(b.perm);
    expect([...a.order].sort()).toEqual([...TILE_IDS].sort());
    expect([...a.perm].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(a.order.join() !== c.order.join() || a.perm.join() !== c.perm.join()).toBe(true);
    expect(a.glitch.at).toBeGreaterThanOrEqual(50 * 60_000);
    expect(a.glitch.at).toBeLessThan(70 * 60_000);
  });
});

describe("schemas", () => {
  it("validates hello, team names, codes and asks", () => {
    expect(cHelloSchema.safeParse({ competition: "vibecoding", role: "player" }).success).toBe(true);
    expect(cHelloSchema.safeParse({ competition: "vibecoding", role: "admin" }).success).toBe(false);
    expect(teamCreateSchema.parse({ name: "  Byte   Me " }).name).toBe("Byte Me");
    expect(teamCreateSchema.safeParse({ name: "x".repeat(25) }).success).toBe(false);
    expect(teamJoinSchema.parse({ code: "ab c1" }).code).toBe("ABC1");
    expect(askSchema.safeParse({ tileId: "hero", text: "x".repeat(601) }).success).toBe(false);
    expect(askSchema.safeParse({ tileId: "nope", text: "hi" }).success).toBe(false);
    expect(hostSettingsSchema.safeParse({ buildMinutes: 5 }).success).toBe(false);
  });

  it("checklists follow the active variant", () => {
    expect(checklist("countdown", "full").map((i) => i.id)).toEqual(["target", "labels", "ticking", "message"]);
    expect(checklist("countdown", "simple").map((i) => i.id)).toEqual(["target"]);
    expect(checklist("register", "simple").map((i) => i.id)).toEqual(["fields", "empty", "success"]);
    expect(checklist("register", "full").map((i) => i.id)).toEqual(["dept", "empty", "bademail", "success"]);
    expect(Object.keys(hooksFor("feedback", "simple"))).toEqual(["star", "rating-text"]);
  });
});

describe("registration", () => {
  it("creates a team with a 4-character code; others join with it", () => {
    const { s, go } = fresh();
    const r = go({ type: "team:create", studentId: "A1", name: "Byte Me" });
    expect(r.ok).toBe(true);
    const t = s.teams[r.teamId!];
    expect(t.code).toMatch(/^[A-Z2-9]{4}$/);
    expect(t.captain).toBe("A1");
    expect(go({ type: "team:join", studentId: "A2", code: t.code }).ok).toBe(true);
    expect(s.people.A2.teamId).toBe(t.id);
    expect(t.members.map((m) => m.studentId)).toEqual(["A1", "A2"]);
  });

  it("enforces unique names, one team per student and the size limit", () => {
    const { s, go } = fresh();
    const t = s.teams[go({ type: "team:create", studentId: "A1", name: "Byte Me" }).teamId!];
    expect(go({ type: "team:create", studentId: "B1", name: "byte me" }).error).toMatch(/taken/);
    expect(go({ type: "team:create", studentId: "A1", name: "Other" }).error).toMatch(/already/);
    for (const id of ["A2", "A3", "A4"]) expect(go({ type: "team:join", studentId: id, code: t.code }).ok).toBe(true);
    expect(go({ type: "team:join", studentId: "A5", code: t.code }).error).toMatch(/full/);
    expect(go({ type: "team:join", studentId: "A5", code: "ZZZZ" }).error).toMatch(/code/);
    expect(go({ type: "team:create", studentId: "ZZ", name: "Ghost" }).error).toMatch(/Join first/);
  });

  it("is READY only with enough members, all ready", () => {
    const { s, go } = fresh();
    const t = s.teams[go({ type: "team:create", studentId: "A1", name: "T" }).teamId!];
    go({ type: "member:ready", studentId: "A1", ready: true });
    expect(t.stage).toBe("registered");
    go({ type: "team:join", studentId: "A2", code: t.code });
    go({ type: "member:ready", studentId: "A2", ready: true });
    expect(t.stage).toBe("ready");
  });

  it("captain can rename and kick; leaving passes the captaincy; empty teams disappear", () => {
    const { s, go } = fresh();
    const t = s.teams[go({ type: "team:create", studentId: "A1", name: "T" }).teamId!];
    go({ type: "team:join", studentId: "A2", code: t.code });
    go({ type: "team:join", studentId: "A3", code: t.code });
    expect(go({ type: "team:rename", studentId: "A2", name: "Nope" }).error).toMatch(/captain/);
    expect(go({ type: "team:rename", studentId: "A1", name: "New Name" }).ok).toBe(true);
    expect(go({ type: "team:kick", studentId: "A1", target: "A3" }).ok).toBe(true);
    expect(s.people.A3.teamId).toBeNull();
    go({ type: "team:leave", studentId: "A1" });
    expect(t.captain).toBe("A2");
    go({ type: "team:leave", studentId: "A2" });
    expect(s.teams[t.id]).toBeUndefined();
    expect(s.teamOrder).not.toContain(t.id);
  });

  it("late joins during warm-up only; locked registration blocks joins", () => {
    const { s, go } = fresh("warmup");
    const t = s.teams[go({ type: "team:create", studentId: "A1", name: "T" }).teamId!];
    expect(go({ type: "team:join", studentId: "A2", code: t.code }).ok).toBe(true);
    go({ type: "settings", patch: { registrationLocked: true } });
    expect(go({ type: "team:join", studentId: "A3", code: t.code }).error).toMatch(/closed/);
    go({ type: "settings", patch: { registrationLocked: false } });
    go({ type: "phase:set", phase: "build" });
    expect(go({ type: "team:join", studentId: "A3", code: t.code }).error).toMatch(/closed/);
  });

  it("phases only move forward; BUILD starts the clock", () => {
    const { s, go } = fresh();
    expect(go({ type: "phase:set", phase: "setup" }).ok).toBe(false);
    expect(go({ type: "phase:set", phase: "build" }, T0 + 1000).ok).toBe(true);
    expect(s.clock.startedAt).toBe(T0 + 1000);
    expect(go({ type: "phase:set", phase: "warmup" }).ok).toBe(false);
  });
});
