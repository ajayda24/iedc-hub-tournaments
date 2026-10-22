/**
 * Funny titles handed out at the podium (and the "you finished" card).
 */
export const podiumTitles = {
  first: "Certified Big Brain",
  second: "So Close It Hurts",
  third: "Bronze, Baby",
  /** 3+ solves in a row */
  streak: "Streak Machine",
  /** last place (when there are more than 3 players) */
  last: "Participation Legend",
  /** never solved anything */
  noSolves: "Vibes Only",
  /** top third */
  topThird: "Low-key Genius",
  /** everyone else */
  rest: "Brain Warming Up",
} as const;
