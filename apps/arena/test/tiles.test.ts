import { describe, expect, it } from "vitest";
import { checklist, TILE_IDS, type ScoredTileId, type TileId, type Variant } from "@iedc/shared/competitions/vibecoding/config";
import { TILES, referenceFragment, starterFragment } from "@iedc/shared/competitions/vibecoding/tiles/index";
import { GLITCH_FRAGMENT } from "@iedc/shared/competitions/vibecoding/rules";
import type { CheckResult, Fragment } from "@iedc/shared/competitions/vibecoding/state";
import { runJob, type PageResult } from "../src/competitions/vibecoding/checks/run";

const TEAM = "Byte Me";
const ALL: TileId[] = ["warmup", ...TILE_IDS];
const tile = (tileId: TileId, variant: Variant, fragment: Fragment) => runJob({ kind: "tile", tileId, variant, fragment, teamName: TEAM }) as CheckResult;
const failing = (r: CheckResult) => Object.entries(r.items).filter(([, ok]) => !ok).map(([id]) => id);

describe("every tile's checks (spec 16.2)", () => {
  for (const id of ALL) {
    for (const variant of ["full", "simple"] as const) {
      it(`${id} (${variant}): the reference passes every check`, () => {
        const r = tile(id, variant, referenceFragment(id, variant, TEAM));
        expect(failing(r)).toEqual([]);
        expect(r.total).toBe(checklist(id, variant).length);
      });
    }
    it(`${id}: each bad fragment fails exactly its intended item`, () => {
      const bads = TILES[id].bad;
      if (id !== "warmup") expect(bads.filter((b) => (b.variant ?? "full") === "full").length).toBeGreaterThanOrEqual(3);
      for (const b of bads) {
        const v = b.variant ?? "full";
        expect({ fails: b.fails, variant: v, failing: failing(tile(id, v, b.fragment)) }).toEqual({ fails: b.fails, variant: v, failing: [b.fails] });
      }
    });
    it(`${id}: the empty starter and the glitch placeholder fail`, () => {
      const r = tile(id, "full", id === "fixit" ? starterFragment(id, "full") : GLITCH_FRAGMENT);
      expect(r.passed).toBeLessThan(r.total);
    });
  }

  it("fix-it starter has exactly its planted bugs", () => {
    expect(failing(tile("fixit", "full", starterFragment("fixit", "full")))).toEqual(["like", "empty"]);
    expect(failing(tile("fixit", "simple", starterFragment("fixit", "simple")))).toEqual(["like"]);
  });
});

describe("site check", () => {
  const refs = Object.fromEntries(TILE_IDS.map((id) => [id, referenceFragment(id, "full", TEAM)])) as Record<ScoredTileId, Fragment>;

  it("all 8 references composed pass every suite, and the page has no errors", () => {
    for (const id of TILE_IDS) {
      const r = runJob({ kind: "siteTile", tileId: id, variant: "full", fragments: refs, teamName: TEAM }) as CheckResult;
      expect({ id, failing: failing(r) }).toEqual({ id, failing: [] });
    }
    const page = runJob({ kind: "sitePage", fragments: refs, teamName: TEAM }) as PageResult;
    expect(page.errors).toEqual([]);
    expect(page.cr).toBeNull();
  });

  it("the theme toggle does not break other sections", () => {
    // feedback still works with the page in dark mode: click the toggle first via a fragment that auto-toggles
    const dark = { ...refs, theme: { ...refs.theme, js: `${refs.theme.js}\ndocument.querySelector('#tile-theme [data-hook="theme-toggle"]').click();` } };
    for (const id of ["feedback", "register", "countdown"] as const) {
      const r = runJob({ kind: "siteTile", tileId: id, variant: "full", fragments: dark, teamName: TEAM }) as CheckResult;
      expect(failing(r)).toEqual([]);
    }
  });

  it("a script error anywhere is reported", () => {
    const broken = { ...refs, gallery: { ...refs.gallery, js: "nope.boom();" } };
    const page = runJob({ kind: "sitePage", fragments: broken, teamName: TEAM }) as PageResult;
    expect(page.errors.length).toBeGreaterThan(0);
  });

  it("change request: the banner with the phrase passes, others don't (all three variants)", () => {
    for (const phrase of ["Free food for all participants!", "Bring your ID card to enter", "Registration closes on 10 Dec"]) {
      const withBanner = { ...refs, hero: { ...refs.hero, html: `${refs.hero.html}<p data-hook="cr-banner">${phrase.toUpperCase()}</p>` } };
      expect((runJob({ kind: "sitePage", fragments: withBanner, teamName: TEAM, crPhrase: phrase }) as PageResult).cr).toBe(true);
      expect((runJob({ kind: "sitePage", fragments: refs, teamName: TEAM, crPhrase: phrase }) as PageResult).cr).toBe(false);
      const wrong = { ...refs, hero: { ...refs.hero, html: `${refs.hero.html}<p data-hook="cr-banner">Something else</p>` } };
      expect((runJob({ kind: "sitePage", fragments: wrong, teamName: TEAM, crPhrase: phrase }) as PageResult).cr).toBe(false);
    }
  });
});
