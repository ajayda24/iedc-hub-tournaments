/**
 * "Live gossip" feed lines shown on every phone and the big screen.
 * `name` is the player's first name.
 */
export const feed = {
  joined: (name: string, dept: string) => `${name} (${dept}) joined the chaos`,
  roundStarting: (roundNo: number, gameTitle: string) => `Round ${roundNo}: ${gameTitle} — get ready!`,
  paused: "Host hit pause. Hands off the screen!",
  firstBlood: (name: string, dept: string, time: string) => `First blood! ${name} (${dept}) cracked it in ${time}`,
  solved: (name: string, time: string) => `${name} solved it — ${time}`,
  /** sent when someone reaches these streak lengths */
  streakAt: [3, 5],
  streak: (name: string, streak: number) => `${name} is on a ${streak}-round streak!`,
  knockedOut: (out: number, left: number) => `${out} player${out > 1 ? "s" : ""} knocked out. ${left} still standing.`,
  podium: "And the winners are…",
  hostAdjusted: (name: string, delta: number) => `Host ${delta >= 0 ? "blessed" : "fined"} ${name} ${delta >= 0 ? "+" : ""}${delta}`,
} as const;
