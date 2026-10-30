import eventJson from "@iedc/config/competitions/vibecoding/event.json";
import tasksJson from "@iedc/config/competitions/vibecoding/tasks.json";
import scoringJson from "@iedc/config/competitions/vibecoding/scoring.json";
import modelsJson from "@iedc/config/competitions/vibecoding/models.json";
import vocabularyJson from "@iedc/config/competitions/vibecoding/vocabulary.json";

/** Typed access to config/competitions/vibecoding/*.json (edit the text and numbers there). */

export type TileId = "warmup" | "hero" | "countdown" | "schedule" | "register" | "theme" | "gallery" | "feedback" | "fixit";
/** The 8 scored tiles, in T1..T8 order (the puzzle piece order). */
export const TILE_IDS = ["hero", "countdown", "schedule", "register", "theme", "gallery", "feedback", "fixit"] as const satisfies readonly TileId[];
export type ScoredTileId = (typeof TILE_IDS)[number];
export type Variant = "full" | "simple";

export interface ChecklistItemConfig {
  id: string;
  text: string;
  simpleText?: string;
  /** only in the full variant */
  full?: boolean;
  /** only in the simple variant */
  simple?: boolean;
}

export interface TileConfig {
  id: TileId;
  title: string;
  emoji: string;
  brief: string;
  par: number;
  variant: Variant;
  hint: string;
  hooks: Record<string, string>;
  simpleHooks?: string[];
  aiNotes?: string;
  items: ChecklistItemConfig[];
}

export interface ChangeRequestConfig {
  id: string;
  text: string;
  phrase: string;
}

export interface ModelConfig {
  id: string;
  label: string;
  role: "primary" | "overflow";
  rpm: number;
  tpm: number;
  rpd: number;
  /** Gemini thinkingConfig.thinkingLevel (e.g. "minimal"); unset = the model's default */
  thinkingLevel?: string;
}

export const EVENT = eventJson;
export const TASKS = tasksJson as unknown as {
  event: { name: string; tagline: string; countdownTarget: string };
  pageOrder: ScoredTileId[];
  genericHints: string[];
  tiles: TileConfig[];
  changeRequests: ChangeRequestConfig[];
};
export const SCORING = scoringJson;
export const MODELS = modelsJson as unknown as {
  maxInFlight: number;
  timeoutMs: number;
  maxOutputTokens: number;
  errorPauseMs: number;
  errorsBeforePause: number;
  models: ModelConfig[];
};
export const VOCABULARY = vocabularyJson as Record<string, { friendly: string; real: string }>;

const byId = new Map(TASKS.tiles.map((t) => [t.id, t]));
export function tileConfig(id: TileId): TileConfig {
  const t = byId.get(id);
  if (!t) throw new Error(`Unknown tile ${id}`);
  return t;
}

/** The checklist students see, for the tile's active variant. What they see is exactly what is checked. */
export function checklist(id: TileId, variant: Variant = tileConfig(id).variant): { id: string; text: string }[] {
  return tileConfig(id)
    .items.filter((i) => (variant === "full" ? !i.simple : !i.full))
    .map((i) => ({ id: i.id, text: variant === "simple" && i.simpleText ? i.simpleText : i.text }));
}

/** Hook names (with meanings) given to the AI for the tile's active variant. */
export function hooksFor(id: TileId, variant: Variant = tileConfig(id).variant): Record<string, string> {
  const t = tileConfig(id);
  if (variant === "full" || !t.simpleHooks) return t.hooks;
  return Object.fromEntries(Object.entries(t.hooks).filter(([k]) => t.simpleHooks!.includes(k)));
}

/** The 3 hints of a tile, in order. */
export function hintsFor(id: TileId): string[] {
  return [tileConfig(id).hint, ...TASKS.genericHints];
}
