/**
 * Solo practice room (/practice). Works offline once the site is installed.
 */
export const practice = {
  home: "← home",
  title: "Practice room",
  intro: "No pressure, no leaderboard. Just you vs. the clock (and your personal best).",
  best: (v: number | string) => `best: ${v}`,
  start: "Start warm-up",
  starting: "Shuffling…",
  backToGames: "← games",
  solved: "Solved",
  timesUp: "Time!",
  points: (n: number) => `${n} pts`,
  inTime: (t: string) => `in ${t}`,
  theAnswer: "the answer",
  otherGames: "Other games",
  again: "Again!",
  roundOver: "Round over.",
} as const;
