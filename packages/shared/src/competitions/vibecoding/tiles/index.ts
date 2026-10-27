import type { TileId, Variant } from "../config";
import type { Fragment } from "../state";
import { norm, type CheckPage, type TileDefinition } from "../checks";
import { warmup } from "./warmup";
import { hero } from "./hero";
import { countdown } from "./countdown";
import { schedule } from "./schedule";
import { register } from "./register";
import { theme } from "./theme";
import { gallery } from "./gallery";
import { feedback } from "./feedback";
import { fixit } from "./fixit";

/** Every tile: starter, reference, bad fragments and checks (one file each). */
export const TILES: Record<TileId, TileDefinition> = { warmup, hero, countdown, schedule, register, theme, gallery, feedback, fixit };

export function starterFragment(id: TileId, variant: Variant): Fragment {
  return TILES[id].starter(variant);
}

export function referenceFragment(id: TileId, variant: Variant, teamName = ""): Fragment {
  return TILES[id].reference(variant, teamName);
}

/** The client's change request: a page-level `cr-banner` containing the phrase. */
export const CR_HOOK = "cr-banner";
export function changeRequestPasses(p: CheckPage, phrase: string): boolean {
  const els = [...p.document.querySelectorAll(`[data-hook="${CR_HOOK}"]`)];
  return els.some((el) => norm(el.textContent).includes(norm(phrase)));
}
