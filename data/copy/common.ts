/**
 * Small words used on several screens.
 */
export const common = {
  connection: { online: "live", connecting: "connecting…", offline: "offline" },
  soundOn: "sound on",
  soundOff: "sound off",
  muted: "muted",
  toggleSound: "toggle sound",
  ok: "ok",
  tabs: { round: "This round", players: "Leaderboard", depts: "Dept wars" },
  /** round status chips on leaderboards */
  status: { solved: "solved", locked: "locked", out: "out" },
  streak: (n: number) => `${n} streak`,
  emptyBoard: "Empty board. Someone score already.",
  noDepartments: "No departments yet.",
  deptLegend: "average score per player · ×players",
  answerWas: "the answer was",
  minutes: (min: number) => `${min} min`,
  /** "1st", "2nd"… */
  ordinal: (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  },
  notFoundTitle: "404. Even Bulbu is lost.",
  notFoundButton: "Take me home",
  offlineTitle: "You're offline",
  offlineBody: "That page wasn't saved for offline use. Practice games still work.",
  offlineButton: "Go practise",
  pageTitles: { play: "Play", host: "Host console", screen: "Big screen", practice: "Practice", offline: "Offline" },
} as const;
