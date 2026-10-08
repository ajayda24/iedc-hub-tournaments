/**
 * Monthly leaderboard page (/leaderboard), online and on the event Wi-Fi.
 */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const leaderboard = {
  pageTitle: "Monthly leaderboard",
  title: "Monthly leaderboard",
  intro: "Every tournament this month adds up. Show up, solve fast, climb.",
  home: "← home",
  lastUpdated: (when: string) => `Last updated: ${when}`,
  /** how dates are written, e.g. "8 Oct 2026, 4:30 pm" */
  formatDate: (iso: string) =>
    new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }),
  /** "2026-10" → "October 2026" */
  monthName: (key: string) => {
    const [y, m] = key.split("-");
    return `${MONTHS[Number(m) - 1] ?? m} ${y}`;
  },
  liveFromLaptop: "live from the arena laptop",
  tabs: { players: "Students", depts: "Dept wars" },
  columns: { played: "played", wins: "wins", points: "pts" },
  played: (n: number) => `${n} played`,
  wins: (n: number) => `${n} win${n === 1 ? "" : "s"}`,
  tournamentsCounted: (n: number) => `${n} tournament${n === 1 ? "" : "s"} counted`,
  playersCount: (n: number) => `${n} players`,
  empty: "No tournaments recorded yet. Come back after the next event!",
  emptyMonth: "Nothing recorded for this month.",
  linkLabel: "Monthly leaderboard →",
} as const;
