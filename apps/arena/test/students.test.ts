import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PIN } from "@iedc/data/rules";
import { Students } from "../src/students";
import { History } from "../src/history";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "arena-test-"));
const profile = { name: "Anjali Nair", dept: "CSE", sem: "S3" };

describe("student PINs", () => {
  it("creates a PIN on first join, then requires it; the PIN itself never touches disk", () => {
    const dir = tmp();
    const s = new Students(dir);
    expect(s.check("IEAXEIT001").exists).toBe(false);
    expect(s.verifyOrCreate("IEAXEIT001", "4821", profile)).toEqual({ ok: true, created: true });
    expect(s.check("IEAXEIT001").exists).toBe(true);
    expect(s.verifyOrCreate("IEAXEIT001", "4821", profile)).toEqual({ ok: true, created: false });
    expect(s.verifyOrCreate("IEAXEIT001", "0000", profile).ok).toBe(false);
    const disk = fs.readFileSync(path.join(dir, "students.json"), "utf8");
    expect(disk).toContain("IEAXEIT001");
    expect(disk).not.toContain("4821");
    // survives a restart
    expect(new Students(dir).verifyOrCreate("IEAXEIT001", "4821", profile).ok).toBe(true);
  });

  it("rejects malformed PINs", () => {
    const s = new Students(null);
    expect(s.verifyOrCreate("A1", "12", profile).ok).toBe(false);
    expect(s.verifyOrCreate("A1", "abcd", profile).ok).toBe(false);
  });

  it("locks after too many wrong tries; the host can unlock or reset", () => {
    let now = 1_000_000;
    const s = new Students(null, () => now);
    s.verifyOrCreate("ROLL42", "1111", profile);
    for (let i = 0; i < PIN.maxTries - 1; i++) {
      const r = s.verifyOrCreate("ROLL42", "2222", profile);
      expect(r.ok).toBe(false);
      expect("locked" in r && r.locked).toBeFalsy();
    }
    expect(s.verifyOrCreate("ROLL42", "2222", profile)).toMatchObject({ ok: false, locked: true });
    // even the right PIN is refused while locked
    expect(s.verifyOrCreate("ROLL42", "1111", profile)).toMatchObject({ ok: false, locked: true });
    expect(s.unlock("ROLL42")).toBe(true);
    expect(s.verifyOrCreate("ROLL42", "1111", profile).ok).toBe(true);
    // lock also expires on its own
    for (let i = 0; i < PIN.maxTries; i++) s.verifyOrCreate("ROLL42", "2222", profile);
    now += PIN.lockMinutes * 60_000 + 1;
    expect(s.verifyOrCreate("ROLL42", "1111", profile).ok).toBe(true);
    // host reset: the next join creates a new PIN
    expect(s.resetPin("ROLL42")).toBe(true);
    expect(s.check("ROLL42").exists).toBe(false);
    expect(s.verifyOrCreate("ROLL42", "9999", profile)).toEqual({ ok: true, created: true });
    expect(s.list()[0]).toMatchObject({ studentId: "ROLL42", hasPin: true });
    expect(JSON.stringify(s.list())).not.toContain("pinHash");
  });
});

describe("monthly history", () => {
  it("records a tournament once, keeps edits, exports without Student IDs", () => {
    const dir = tmp();
    const h = new History(dir);
    const players = [{ studentId: "IEAXEIT001", name: "Anjali", dept: "CSE", sem: "S3", score: 900, rank: 1, solves: 2 }];
    expect(h.record({ id: "e1", name: "Brain Night", players }).ok).toBe(true);
    h.edit("e1", { name: "Brain Night #1" });
    h.record({ id: "e1", name: "ignored", players: [{ ...players[0], score: 1000 }] });
    const all = new History(dir).all();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("Brain Night #1");
    expect(all[0].players[0].score).toBe(1000);
    const file = h.exportMonthly();
    expect(Object.values(file.months)[0].standings[0]).toMatchObject({ name: "Anjali", points: 1000 });
    expect(JSON.stringify(file)).not.toContain("IEAXEIT001");
    expect(h.record({ id: "e2", name: "empty", players: [] }).ok).toBe(false);
  });
});
