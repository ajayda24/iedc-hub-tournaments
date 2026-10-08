/**
 * Host console (/host). Only the host sees these.
 */
export const host = {
  // PIN screen
  title: "Host console",
  pinHint: "The PIN is printed in the arena terminal on the laptop.",
  pinPlaceholder: "••••",
  enter: "Enter",
  cantReach: "Can't reach the arena server.",
  failed: "Failed",

  // header
  online: (online: number, total: number) => `${online}/${total} online`,
  openScreen: "Open big screen ↗",
  exportCsv: "Export CSV",
  csvFileSuffix: "-results.csv",

  // right-hand tabs
  tabPlayers: (n: number) => `Players (${n})`,
  tabFlags: (newCount: number) => `Flags${newCount ? ` · ${newCount} new` : ""}`,
  tabNetwork: "Network doctor",
  tabBoard: "Leaderboard",

  // round controls
  knockoutChip: (pct: number) => `knockout ${pct}%`,
  startingIn: (s: number) => `Starting in ${s}…`,
  solvedOf: (n: number) => `/ ${n} solved`,
  firstBlood: (name: string) => `first blood: ${name}`,
  resume: "Resume",
  pause: "Pause",
  endRound: "End round now",
  confirmEndRound: "End this round now? Unfinished players get partial credit.",
  startRound: (n: number, game: string, difficulty: string) => `▶ Start R${n}: ${game} (${difficulty})`,
  playlistDone: "Playlist finished — add a round or crown the winners.",
  showPodium: "Show podium",
  backToLobby: "Back to lobby",
  waitingForPlayers: "Waiting for players — show the QR from the Network tab or the big screen.",

  // playlist
  playlist: "Playlist",
  discard: "Discard",
  saveChanges: "Save changes",
  seconds: "s",
  moveUp: "move up",
  moveDown: "move down",
  removeRound: "remove round",
  customWordsPlaceholder: "words separated by spaces or commas (min 3)",
  playNext: "play this one next instead →",
  add: "add:",

  // event settings
  settings: "Event settings",
  saveSettings: "Save settings",
  eventName: "Event name",
  format: "Format",
  formats: { classic: "classic", knockout: "knockout" },
  knockoutPct: (pct: number) => `Knock out bottom ${pct}% each round`,
  blockInternet: "Freeze players whose phone has internet",
  penaltyAt: (pts: number) => `−${pts} penalty at strike #`,
  lockAt: "Round lock at strike #",
  strikeHelp: "A strike = leaving the game for over 1.5s during a round, or internet detected (once per round).",

  // danger zone
  danger: "Danger zone",
  resetScores: "Reset scores",
  confirmResetScores: "Reset all scores but keep players joined?",
  newEvent: "New event",
  confirmNewEvent: "Start a brand new event? Everyone must join again.",

  // players tab
  search: "Search name / dept…",
  nobody: "Nobody here yet.",
  internetChip: "internet!",
  strikes: (n: number) => `${n} strike${n > 1 ? "s" : ""}`,
  unblock: "unblock",
  kick: "kick",
  confirmKick: (name: string) => `Remove ${name}?`,
  /** points added/removed by the quick buttons */
  adjustStep: 100,

  // flags tab
  noFlags: "Clean game so far. Suspicious.",

  // network tab
  laptopHasInternet: "This laptop has internet",
  laptopHasInternetBody:
    "If students are on this network they could reach AI tools. Use the laptop's own hotspot (sharing a loopback adapter) or turn off the hotspot phone's mobile data.",
  laptopOffline: "No internet on the arena laptop",
  noNetwork: "No network yet. Turn on the hotspot.",
  perIp: "Players per source IP",
  perIpHint: "Players behind one repeater phone share its IP. Phones usually cope with 8–15 each.",
  /** highlight a source IP in red above this many players */
  perIpWarnAt: 12,
  cheatSheet: "Hotspot cheat-sheet",
  cheatSheetTips: [
    "Windows: run setup-hotspot.ps1 once as admin (raises the client limit to 128), then start-arena.bat.",
    "The laptop hotspot is always 192.168.137.1, so print the QR before the event.",
    "Overflow: a phone with \"Wi-Fi sharing\" joins the laptop hotspot and re-shares it. Same URL works.",
    "Any phone hotspot used must have mobile data OFF.",
  ],

  // board tab
  boardPlayers: "Players",
  boardDepts: "Dept wars",
} as const;
