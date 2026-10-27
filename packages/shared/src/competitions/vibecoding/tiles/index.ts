import type { TileId, Variant } from "../config";
import type { Fragment } from "../state";

/** Starter, reference and bad fragments for every tile. Filled in tile by tile (see ./<id>.ts). */
export function starterFragment(_id: TileId, _variant: Variant): Fragment {
  return { html: "", css: "", js: "" };
}
