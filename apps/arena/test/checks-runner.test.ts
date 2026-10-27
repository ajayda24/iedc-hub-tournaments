import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TILE_IDS, type ScoredTileId } from "@iedc/shared/competitions/vibecoding/config";
import { referenceFragment } from "@iedc/shared/competitions/vibecoding/tiles/index";
import type { Fragment } from "@iedc/shared/competitions/vibecoding/state";
import { CheckRunner } from "../src/competitions/vibecoding/checks/runner";

const TEAM = "Byte Me";
const refs = () => Object.fromEntries(TILE_IDS.map((id) => [id, referenceFragment(id, "full", TEAM)])) as Record<ScoredTileId, Fragment>;
const fullVariants = Object.fromEntries(TILE_IDS.map((id) => [id, "full"])) as Record<ScoredTileId, "full">;

let runner: CheckRunner;
beforeAll(() => {
  runner = new CheckRunner({ size: 2, timeoutMs: 3000 });
});
afterAll(async () => {
  await runner.close();
});

describe("check runner (worker threads)", () => {
  it("checks a tile in a worker", async () => {
    const r = await runner.checkTile("hero", "full", referenceFragment("hero", "full"), TEAM);
    expect(r.passed).toBe(r.total);
  });

  it("the site check passes for all references, in any completion order", async () => {
    const site = await runner.checkSite(refs(), fullVariants, TEAM);
    expect(site.pageErrors).toEqual([]);
    expect(site.ok).toBe(true);
    // order of completion doesn't matter: the composer always uses page order
    const shuffled = Object.fromEntries([...TILE_IDS].reverse().map((id) => [id, refs()[id]])) as Record<ScoredTileId, Fragment>;
    expect((await runner.checkSite(shuffled, fullVariants, TEAM)).ok).toBe(true);
  });

  it("an endless loop is killed within the timeout and the runner recovers", async () => {
    const t0 = Date.now();
    const r = await runner.checkTile("hero", "full", { html: "<h1>x</h1>", css: "", js: "while(true){}" }, TEAM);
    expect(r.passed).toBe(0);
    expect(Date.now() - t0).toBeLessThan(6000);
    const ok = await runner.checkTile("hero", "full", referenceFragment("hero", "full"), TEAM);
    expect(ok.passed).toBe(ok.total);
  });

  it("a memory bomb is killed and the runner recovers", async () => {
    const bomb = "var a=[];for(;;){a.push(new Array(1e6).fill(Math.random()))}";
    const r = await runner.checkTile("gallery", "full", { html: "<p>x</p>", css: "", js: bomb }, TEAM);
    expect(r.passed).toBe(0);
    const ok = await runner.checkTile("gallery", "full", referenceFragment("gallery", "full"), TEAM);
    expect(ok.passed).toBe(ok.total);
  });

  it("network attempts fail harmlessly; a huge DOM doesn't hang the arena", async () => {
    const net = await runner.checkTile(
      "hero",
      "full",
      { ...referenceFragment("hero", "full"), js: "try{new XMLHttpRequest()}catch(e){}; fetch('http://x').catch(function(){}); try{new WebSocket('ws://x')}catch(e){}" },
      TEAM,
    );
    expect(net.passed).toBe(net.total);
    const huge = await runner.checkTile("schedule", "full", { html: "", css: "", js: "for(var i=0;i<3e5;i++){document.body.appendChild(document.createElement('div'))}" }, TEAM);
    expect(huge.passed).toBe(0);
  });
});
