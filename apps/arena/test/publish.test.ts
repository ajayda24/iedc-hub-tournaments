import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { teamScore } from "@iedc/shared/competitions/vibecoding/scoring";
import { EVC, type PublishAck } from "@iedc/shared/competitions/vibecoding/protocol";
import { TILE_IDS, TASKS } from "@iedc/shared/competitions/vibecoding/config";
import { solvePath } from "@iedc/shared/competitions/vibecoding/puzzle";
import { joinPayload, startServer } from "./competitions.test";

let srv: Awaited<ReturnType<typeof startServer>> | null = null;
afterEach(async () => {
  await srv?.close();
  srv = null;
});

async function finishedTeam() {
  srv = await startServer();
  const host = await srv.client("host", { pin: "2468" });
  await host.s.emitWithAck(EVC.hostPhase, { phase: "registration" });
  await host.s.emitWithAck(EVC.hostSettings, { glitch: false });
  const a = await srv.client("player", { token: "tok-A1-xxxxxxxx" });
  await a.s.emitWithAck(EVC.join, joinPayload("A1", "Asha"));
  await a.s.emitWithAck(EVC.teamCreate, { name: "Byte Me" });
  await host.s.emitWithAck(EVC.hostPhase, { phase: "build" });
  const t = () => Object.values(srv!.room.state.teams)[0];
  for (const id of TILE_IDS) expect((await host.s.emitWithAck(EVC.hostTeam, { op: "unlockTile", teamId: t().id, tileId: id })).ok).toBe(true);
  return { host: host.s, a: a.s, t };
}

describe("puzzle, publish, change request (spec 8–9)", () => {
  it("8 tiles start the puzzle; moves are validated; stale moves get the board back", async () => {
    const { a, t } = await finishedTeam();
    expect(t().stage).toBe("puzzle");
    const p = t().puzzle!;
    const bad = await a.emitWithAck(EVC.puzzleMove, { cell: p.board.indexOf(0), version: p.version });
    expect(bad.ok).toBe(false);
    expect(bad.board).toEqual(p.board);
    const stale = await a.emitWithAck(EVC.puzzleMove, { cell: solvePath(p.board)[0], version: p.version + 5 });
    expect(stale.error).toMatch(/moved first/);
    expect((await a.emitWithAck(EVC.publishGo)).error).toMatch(/Solve the puzzle/);
    for (const cell of solvePath(t().puzzle!.board)) expect((await a.emitWithAck(EVC.puzzleMove, { cell, version: t().puzzle!.version })).ok).toBe(true);
    expect(t().puzzle!.solvedAt).not.toBeNull();
    expect(t().puzzle!.moves).toBe(p.optimal);
  });

  it("publish runs the site check, serves the site on its own port with a CSP, then the client calls", async () => {
    const { a, t, host } = await finishedTeam();
    for (const cell of solvePath(t().puzzle!.board)) await a.emitWithAck(EVC.puzzleMove, { cell, version: t().puzzle!.version });

    // break one tile: Go Back to its empty auto-save from before the unlock
    await a.emitWithAck(EVC.tileOpen, { tileId: "gallery" });
    const empty = t().tiles.gallery.autos[0].id;
    await a.timeout(10_000).emitWithAck(EVC.saveRestore, { tileId: "gallery", saveId: empty });
    const failed: PublishAck = await a.timeout(30_000).emitWithAck(EVC.publishGo);
    expect(failed.ok).toBe(false);
    expect(failed.problems!.map((p) => p.tileId)).toEqual(["gallery"]);
    expect(t().publish).toBeNull();

    // fix it with an Ask (the mock answers with the reference)
    await a.timeout(10_000).emitWithAck(EVC.askSend, { tileId: "gallery", text: "six cards please" });
    const ok: PublishAck = await a.timeout(30_000).emitWithAck(EVC.publishGo);
    expect(ok.ok).toBe(true);
    expect(ok.sitePath).toMatch(/^\/s\/byte-me-t1\/$/);
    expect(t().stage).toBe("change_request");
    const res = await fetch(`http://127.0.0.1:${srv!.sitesPort}${ok.sitePath}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    const html = await res.text();
    expect(html).toContain("IEDC Fest 2026");
    expect(html).toContain("Content-Security-Policy");
    const dl = await fetch(`http://127.0.0.1:${srv!.sitesPort}${ok.sitePath}index.html?download=1`);
    expect(dl.headers.get("content-disposition")).toContain("attachment");
    const gallery = await (await fetch(`http://127.0.0.1:${srv!.sitesPort}/sites/`)).text();
    expect(gallery).toContain("Byte Me");

    // the change request: add the line with an Ask, publish again
    const cr = TASKS.changeRequests.find((c) => c.id === t().changeRequest!.variant)!;
    const again1: PublishAck = await a.timeout(30_000).emitWithAck(EVC.publishGo);
    expect(again1.ok).toBe(true);
    expect(again1.problems!.map((p) => p.tileId)).toEqual(["change"]);
    expect(t().changeRequest!.doneAt).toBeNull();
    await new Promise((r) => setTimeout(r, 10));
    srv!.room.state.teams[t().id].cooldownUntil = 0; // skip the cooldown from the gallery fix
    await a.emitWithAck(EVC.tileOpen, { tileId: "hero" });
    const asked = await a.timeout(10_000).emitWithAck(EVC.askSend, { tileId: "hero", text: `Please add the line '${cr.phrase}' to the page` });
    expect(asked.ok).toBe(true);
    const again2: PublishAck = await a.timeout(30_000).emitWithAck(EVC.publishGo);
    expect(again2.ok).toBe(true);
    expect(again2.problems).toEqual([]);
    expect(t().changeRequest!.doneAt).not.toBeNull();
    expect(t().stage).toBe("done");
    expect(t().publish!.count).toBe(3);
    expect(await (await fetch(`http://127.0.0.1:${srv!.sitesPort}${ok.sitePath}`)).text()).toContain(cr.phrase);

    // published sites stay online after the freeze
    await host.emitWithAck(EVC.hostPhase, { phase: "frozen" });
    expect((await fetch(`http://127.0.0.1:${srv!.sitesPort}${ok.sitePath}`)).status).toBe(200);
    expect((await a.emitWithAck(EVC.publishGo)).error).toMatch(/frozen/);

    // freezing exports the results; they match the state (spec 16.3)
    const dir = path.join(srv!.dataDir, "competitions", "vibecoding", "runs", srv!.room.state.runId);
    const results = JSON.parse(fs.readFileSync(path.join(dir, "results.json"), "utf8"));
    expect(results.teams).toHaveLength(1);
    expect(results.teams[0]).toMatchObject({
      rank: 1,
      team: "Byte Me",
      size: 1,
      members: [{ name: "Asha", studentId: "A1" }],
      score: teamScore(srv!.room.state, t()).total,
      publishCount: 3,
      puzzle: { moves: t().puzzle!.moves, optimal: t().puzzle!.optimal },
    });
    expect(results.teams[0].tiles.hero.help).toBe("host");
    const csv = fs.readFileSync(path.join(dir, "results.csv"), "utf8");
    expect(csv.split(/\r?\n/)[1]).toMatch(/^1,Byte Me,1,Asha,A1,CSE,/);
  });
});
