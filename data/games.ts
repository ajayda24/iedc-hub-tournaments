/**
 * Everything players read about each game: names, one-liners, rules, colours,
 * default round lengths, and the order games appear in lists.
 */
export type GameKey = "sudoku" | "wordhunt" | "anagram" | "numbercrunch";
export type DifficultyKey = "easy" | "med" | "hard";
export type ColorKey = "yellow" | "mint" | "coral" | "sky";

export interface GameText {
  id: GameKey;
  title: string;
  tagline: string;
  howTo: string;
  /** highlighter colour for this game's cards and banners */
  color: ColorKey;
  /** default round length in seconds per difficulty (host can change per round) */
  defaultTimeSec: Record<DifficultyKey, number>;
}

export const GAMES: Record<GameKey, GameText> = {
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

/** Order of games on the landing page, practice room and host "add round" buttons */
export const GAME_ORDER: GameKey[] = ["anagram", "sudoku", "wordhunt", "numbercrunch"];

/** How difficulties are written everywhere */
export const DIFFICULTY_LABEL: Record<DifficultyKey, string> = { easy: "easy", med: "medium", hard: "hard" };

/** Anagram word packs offered in the host's round settings (ids match words/anagram-packs.source.json) */
export const ANAGRAM_PACK_OPTIONS: { id: string; label: string }[] = [
  { id: "mixed", label: "Mixed bag" },
  { id: "tech", label: "Tech talk" },
  { id: "campus", label: "Campus life" },
  { id: "food", label: "Snack attack" },
  { id: "science", label: "Lab rats" },
  { id: "custom", label: "Custom words" },
];

/** Starting words when the host picks "Custom words" */
export const DEFAULT_CUSTOM_WORDS = ["iedc", "startup", "idea"];
