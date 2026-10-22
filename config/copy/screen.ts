/**
 * Big screen / projector (/screen).
 */
export const screen = {
  waiting: "waiting for the arena…",
  players: (n: number) => `${n} players`,
  scanToJoin: "scan to join",
  hotspotOff: "Turn on the hotspot…",
  via: (label: string) => `via ${label}`,
  brainsInRoom: "brains in the room",
  firstUp: "First up:",
  roundOf: (n: number, total: number) => `round ${n} of ${total}`,
  go: "GO",
  roundLabel: (n: number, difficulty: string) => `round ${n} · ${difficulty}`,
  liveTop: "Live top 10",
  ofSolved: (n: number) => `of ${n} solved`,
  paused: "paused",
  firstBlood: "first blood",
  roundDone: (n: number) => `Round ${n} done · `,
  views: { round: "this round", overall: "overall", depts: "dept wars" },
  /** seconds each results panel stays up before rotating */
  rotateEverySec: 9,
  nextUp: "Next up:",
  champions: "Champions",
  deptWars: "Dept wars",
} as const;
