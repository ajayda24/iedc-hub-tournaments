/**
 * Numbers that decide how the game plays: scoring, default event, timings.
 */
import type { DifficultyKey, GameKey } from "./games";

/** Points */
export const SCORING = {
  /** base points for solving (× difficulty multiplier below) */
  base: 1000,
  /** bonus for speed, shrinking to 0 as the clock runs out */
  speedMax: 500,
  /** extra for the very first solver of a round */
  firstBlood: 100,
  /** lost per wrong Sudoku check */
  wrongPenalty: 25,
  /** most you can get without solving (partial credit) */
  partialMax: 300,
  /** lost on the "penalty" anti-cheat strike */
  strikePenalty: 200,
  /** a solve is never worth less than this */
  minSolve: 100,
} as const;

export const DIFFICULTY_MULTIPLIER: Record<DifficultyKey, number> = { easy: 1, med: 1.5, hard: 2 };

/** What a fresh event looks like before the host edits anything */
export interface DefaultRound {
  id: string;
  game: GameKey;
  difficulty: DifficultyKey;
  timeLimitSec: number;
}
export const DEFAULT_EVENT: {
  format: "classic" | "knockout";
  knockoutPct: number;
  rounds: DefaultRound[];
  strikePenaltyAt: number;
  strikeLockAt: number;
  blockInternet: boolean;
} = {
  format: "classic",
  /** knockout mode: % of players out after each round */
  knockoutPct: 25,
  rounds: [
    { id: "r1", game: "anagram", difficulty: "easy", timeLimitSec: 120 },
    { id: "r2", game: "sudoku", difficulty: "easy", timeLimitSec: 150 },
    { id: "r3", game: "wordhunt", difficulty: "med", timeLimitSec: 150 },
    { id: "r4", game: "numbercrunch", difficulty: "med", timeLimitSec: 120 },
  ],
  /** strike number that costs SCORING.strikePenalty */
  strikePenaltyAt: 2,
  /** strike number that locks a player out of the round */
  strikeLockAt: 3,
  /** freeze phones that can reach the internet */
  blockInternet: true,
};

/** 3-2-1 countdown before a puzzle appears (ms) */
export const COUNTDOWN_MS = 3500;

/** Anti-cheat timings (ms) */
export const ANTICHEAT = {
  /** how often each phone checks for internet */
  probeEveryMs: 8000,
  /** how often while it is still online (to unfreeze quickly) */
  probeWhileOnlineMs: 4000,
  /** give up on a probe after this long */
  probeTimeoutMs: 2500,
  /** leaving the game for less than this is forgiven (notification shade etc.) */
  focusGraceMs: 1500,
} as const;

/** Leaderboard rows sent to phones while a round is live */
export const LIVE_LEADERBOARD_SIZE = 10;

/** Student ID field on the join form (college ID, or admission / roll no. for new students) */
export const STUDENT_ID = {
  /** longest ID accepted */
  maxLength: 10,
} as const;

/** Student PIN protection */
export const PIN = {
  /** digits in a PIN */
  length: 4,
  /** wrong tries before the Student ID is locked */
  maxTries: 5,
  /** how long the lock lasts (minutes); the host can also unlock */
  lockMinutes: 10,
} as const;

/** Monthly leaderboard */
export const MONTHLY = {
  /**
   * "points"     = add up each student's scores from every tournament that month
   * "rankPoints" = award rank points per tournament (1st 25, 2nd 18, 3rd 15 …), F1-style
   */
  method: "points" as "points" | "rankPoints",
  rankPoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  /** months shown on the public page (newest first) */
  monthsShown: 12,
};
