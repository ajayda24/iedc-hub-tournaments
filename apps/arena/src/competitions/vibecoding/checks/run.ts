import { checklist, TILE_IDS, tileConfig, type ScoredTileId, type TileId, type Variant } from "@iedc/shared/competitions/vibecoding/config";
import { compose } from "@iedc/shared/competitions/vibecoding/composer";
import { TILES, changeRequestPasses } from "@iedc/shared/competitions/vibecoding/tiles/index";
import type { CheckResult, Fragment } from "@iedc/shared/competitions/vibecoding/state";
import { makePage } from "./page";

/** What the arena asks the check runner to do. */
export type CheckJob =
  /** one tile, alone on a page (Check button, after every Ask) */
  | { kind: "tile"; tileId: TileId; variant: Variant; fragment: Fragment; teamName: string }
  /** one tile's checks on the whole composed site (part of the site check) */
  | { kind: "siteTile"; tileId: ScoredTileId; variant: Variant; fragments: Record<ScoredTileId, Fragment>; teamName: string }
  /** the whole site loads without uncaught errors; optionally the change request */
  | { kind: "sitePage"; fragments: Record<ScoredTileId, Fragment>; teamName: string; crPhrase?: string };

export interface PageResult {
  errors: string[];
  cr: boolean | null;
}

export type JobResult = CheckResult | PageResult;

/** Run one checklist item on a fresh page. A throwing check is a failing check. */
function runItem(source: string, tileId: TileId, itemId: string, fragment: Fragment, teamName: string): boolean {
  const item = TILES[tileId].checks[itemId];
  if (!item) return false;
  const { page, close } = makePage(source, { start: item.start, sectionId: `tile-${tileId}`, css: fragment.css, html: fragment.html, teamName });
  try {
    return item.run(page) === true;
  } catch {
    return false;
  } finally {
    close();
  }
}

function result(items: Record<string, boolean>): CheckResult {
  const vals = Object.values(items);
  return { items, passed: vals.filter(Boolean).length, total: vals.length, at: Date.now() };
}

export function runJob(job: CheckJob): JobResult {
  if (job.kind === "tile") {
    const source = compose({ [job.tileId]: job.fragment }, { tiles: [job.tileId], title: tileConfig(job.tileId).title });
    const items: Record<string, boolean> = {};
    for (const it of checklist(job.tileId, job.variant)) items[it.id] = runItem(source, job.tileId, it.id, job.fragment, job.teamName);
    return result(items);
  }
  if (job.kind === "siteTile") {
    const source = compose(job.fragments);
    const items: Record<string, boolean> = {};
    for (const it of checklist(job.tileId, job.variant)) items[it.id] = runItem(source, job.tileId, it.id, job.fragments[job.tileId], job.teamName);
    return result(items);
  }
  const source = compose(job.fragments);
  const { page, close } = makePage(source, { sectionId: "tile-hero", css: "", html: "", teamName: job.teamName });
  try {
    page.clock.advance(2000);
    const cr = job.crPhrase ? changeRequestPasses(page, job.crPhrase) : null;
    return { errors: [...page.errors], cr };
  } finally {
    close();
  }
}

export const ALL_SCORED: readonly ScoredTileId[] = TILE_IDS;
