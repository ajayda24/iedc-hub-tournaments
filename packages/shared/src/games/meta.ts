import { GAMES, GAME_ORDER as ORDER, type GameText } from "@iedc/data/games";
import type { GameId } from "./types";

/** Display info for each game. Edit the text in data/games.ts. */
export type GameMeta = GameText;
export const GAME_META: Record<GameId, GameMeta> = GAMES;
export const GAME_ORDER: GameId[] = ORDER;
