import type { GameDefinition, GameId } from "./types";
import { sudoku } from "./sudoku/engine";
import { wordhunt } from "./wordhunt/engine";
import { anagram } from "./anagram/engine";
import { numbercrunch } from "./numbercrunch/engine";

export const GAMES: Record<GameId, GameDefinition> = { sudoku, wordhunt, anagram, numbercrunch };
export const GAME_IDS = Object.keys(GAMES) as GameId[];

export function getGame(id: GameId): GameDefinition {
  const g = GAMES[id];
  if (!g) throw new Error(`Unknown game ${id}`);
  return g;
}

export * from "./types";
export { sudoku, wordhunt, anagram, numbercrunch };
