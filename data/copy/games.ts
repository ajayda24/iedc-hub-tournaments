/**
 * Messages inside the games (checked on the server, shown under the puzzle).
 */
export const gameText = {
  sudoku: {
    gridMismatch: "That grid doesn't fit.",
    fillEveryCell: "Fill every cell first.",
    wrongCells: (n: number) => (n === 1 ? "One cell is lying to you." : `${n} cells are wrong.`),
    notQuite: "Not quite.",
    eraseButton: "Erase",
    pencilButton: "Pencil",
    pencilOnButton: "Pencil ✓",
    undoButton: "Undo",
    /** screen-reader label for each cell */
    cellLabel: (row: number, col: number, value: number) => `row ${row} column ${col}${value ? ` is ${value}` : " empty"}`,
  },
  wordhunt: {
    needsLetters: (n: number) => `Needs ${n} letters.`,
    notAWord: "Not in our dictionary. Nice try.",
    alreadyTried: "You already tried that one.",
    outOfGuesses: "Out of guesses. Partial credit for your best row.",
    hmm: "Hmm.",
    enterKey: "ENTER",
    /** screen-reader label for the ⌫ key */
    backspaceLabel: "backspace",
  },
  anagram: {
    noSuchWord: "No such word.",
    alreadySolved: "Already solved.",
    rightLettersWrongWord: "Right letters, wrong word.",
    nope: "Nope.",
    allDone: "All unscrambled. Show-off.",
    clearButton: "Clear",
    skipButton: "Skip →",
    /** screen-reader label for the answer slots */
    removeLetterLabel: "remove last letter",
    /** title of the pack made from the host's own words */
    customPackTitle: "Host's Special",
    mixedPackTitle: "Mixed Bag",
  },
  numbercrunch: {
    buildSomething: "Build something first.",
    tooLong: "Too long.",
    onlyNumbersAndOps: "Only numbers and + − × ÷.",
    divisionWhole: "Division must come out whole.",
    noNegatives: "No negatives or zero along the way.",
    divideEvenly: "Must divide evenly.",
    missingBracket: "Missing a bracket.",
    broken: "That expression is broken.",
    noSpare: (n: number) => `You don't have a spare ${n}.`,
    soClose: (d: number) => `So close — ${d} away.`,
    offBy: (value: number, d: number) => `${value}. Off by ${d}.`,
    makeThis: "make this",
    tapNumber: "tap a number",
    tapOperation: "now an operation",
    tapAnother: "now another number",
    undoButton: "Undo",
    resetButton: "Reset",
    submitButton: (v: number | string) => `Submit ${v}`,
    closest: "Closest so far:",
    away: (d: number) => `(${d} away)`,
  },
  /** shown while a game screen downloads */
  loading: "sharpening pencils…",
  /** shown when the connection drops mid-move */
  lostConnection: "Lost the arena for a sec — try again.",
} as const;
