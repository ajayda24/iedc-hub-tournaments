/**
 * Student phone screens (/play) after joining.
 */
export const play = {
  // connection problems
  bumpedTitle: "This tab is asleep",
  kickedTitle: "You're out of this one",
  tryAgain: "Try joining again",
  offlineTitle: "Can't reach the arena",
  offlineBody: "Make sure you're on the event Wi-Fi (the host's hotspot), then hang on — we retry automatically.",
  connectingTitle: "Finding the arena…",
  connectingBody: "Waking up the host laptop.",

  // lobby
  youreIn: "You're in,",
  hostCooking: "Host is cooking. Don't touch anything.",
  playersJoined: "players joined",
  roundsPlayed: "rounds played",
  liveGossip: "Live gossip",
  nextUp: "next up",

  // countdown
  roundOf: (n: number, total: number) => `round ${n} of ${total}`,
  go: "GO",
  fullscreen: "Go fullscreen (fewer accidents)",

  // playing
  you: "You",
  solvedCount: (solved: number, total: number) => `${solved}/${total} solved`,
  pausedBold: "Paused by the host.",
  pausedRest: " Hands off — the clock is frozen.",
  liveTop: "Live top 10",

  /** card shown when you're finished with a round */
  done: {
    solved: { title: "SOLVED", body: "Sit back and watch the others sweat." },
    failed: { title: "Out of tries", body: "Partial credit is on its way." },
    locked: { title: "Locked", body: "Too many strikes this round. Talk to the host." },
    out: { title: "Spectating", body: "Knocked out — but you can still cheer." },
    timeout: { title: "Time!", body: "" },
  },

  // results
  resultsRound: (n: number, game: string) => `round ${n} · ${game}`,
  resultSolved: "Nailed it.",
  resultSome: "Some points!",
  resultNone: "Oof.",
  nowRank: (rank: string, of: number) => `now ${rank} of ${of}`,
  up: (n: number) => `up ${n}`,
  down: (n: number) => `down ${n}`,
  knockedOut: "You've been knocked out. Stick around for the finale!",

  // podium
  wrap: "That's a wrap!",
  youFinished: "you finished",
  points: (n: number) => `${n} points`,
} as const;
