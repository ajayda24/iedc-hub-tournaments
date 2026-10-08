/**
 * Messages the arena server sends back when something can't be done.
 * Players and the host see these as small red notes or pop-ups.
 */
export const errors = {
  // joining
  removedByHost: "The host removed you from this event.",
  wrongPin: (left: number) => (left > 0 ? `Wrong PIN. ${left} ${left === 1 ? "try" : "tries"} left.` : "Wrong PIN."),
  pinLocked: (minutes: number) => `Too many wrong PINs. Try again in ${minutes} min, or ask the host to unlock you.`,
  pinFormat: (n: number) => `The PIN must be exactly ${n} digits.`,
  badStudentId: "That Student ID doesn't look right.",
  duplicateName: "Someone with that exact name and department already joined. Add an initial?",
  joinFormIncomplete: "Fill in your name, semester and department.",
  freshEvent: "The host started a fresh event. Join again!",
  openedElsewhere: "You opened the game somewhere else. This tab is now asleep.",
  joinFirst: "Join first.",
  badHello: "Bad hello",
  wrongHostPin: "Wrong PIN",
  hostOnly: "Host only.",

  // host round controls
  roundAlreadyRunning: "A round is already running.",
  playlistFinished: "No round left in the playlist. Add one, or show the podium.",
  nobodyJoined: "Nobody has joined yet.",
  nothingToPause: "Nothing to pause.",
  notPaused: "Not paused.",
  noRunningRound: "No running round.",
  endRoundFirst: "End the round first.",
  noSuchPlayer: "No such player.",

  // monthly history
  nothingToRecord: "Nobody with a Student ID played this tournament.",
  noSuchTournament: "No such tournament.",
  badBackup: "That file isn't a Brain Arena history backup.",

  // submitting answers
  notInEvent: "Not in this event.",
  roundOver: "That round is over.",
  roundNotLive: "Hold on — the round isn't live.",
  paused: "Paused.",
  timesUp: "Time's up!",
  spectating: "You're spectating this one.",
  internetOn: "Turn off mobile data to keep playing.",
  lockedOut: "Locked for this round. Ask the host.",
  alreadyDone: "You're done with this one.",
  tooFast: "Slow down, speedrunner.",
  badMove: "Bad move.",
} as const;
