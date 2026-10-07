import type { Difficulty, GameColor, GameId } from "./types";

export interface GameMeta {
  id: GameId;
  title: string;
  tagline: string;
  howTo: string;
  color: GameColor;
  defaultTimeSec: Record<Difficulty, number>;
}

/** Display info for each game. Dependency-free so the browser can import it cheaply. */
export const GAME_META: Record<GameId, GameMeta> = {
  sudoku: {
    id: "sudoku",
    title: "Mini Sudoku",
    tagline: "Numbers. Boxes. Zero chill.",
    howTo: "Fill every row, column and box with each number exactly once. A full grid is checked automatically — wrong checks cost 25 points.",
    color: "mint",
    defaultTimeSec: { easy: 150, med: 210, hard: 420 },
  },
  wordhunt: {
    id: "wordhunt",
    title: "Word Hunt",
    tagline: "Five letters. Six tries. One ego.",
    howTo: "Guess the 5-letter word. Green = right spot, yellow = wrong spot, grey = not in the word. Fewer guesses and faster solves score more.",
    color: "yellow",
    defaultTimeSec: { easy: 180, med: 150, hard: 120 },
  },
  anagram: {
    id: "anagram",
    title: "Anagram Blitz",
    tagline: "Unscramble faster than your crush replies.",
    howTo: "Each tile row is a scrambled word. Type the real word. Skip if stuck and come back. Solve all of them to finish.",
    color: "coral",
    defaultTimeSec: { easy: 120, med: 150, hard: 180 },
  },
  numbercrunch: {
    id: "numbercrunch",
    title: "Number Crunch",
    tagline: "Maths, but make it a street fight.",
    howTo: "Hit the target using the given numbers with + − × ÷. Each number once. No fractions, no negatives. Close counts for a little.",
    color: "sky",
    defaultTimeSec: { easy: 90, med: 120, hard: 150 },
  },
};

export const GAME_ORDER: GameId[] = ["anagram", "sudoku", "wordhunt", "numbercrunch"];
