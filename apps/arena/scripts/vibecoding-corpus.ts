import type { ScoredTileId } from "@iedc/shared/competitions/vibecoding/config";

/**
 * The quality corpus (spec 16.6): 3 beginner prompts per tile, from vague to
 * detailed, in English, Malayalam and Manglish, the way students really type.
 */
export interface CorpusPrompt {
  tile: ScoredTileId;
  level: "vague" | "medium" | "detailed";
  lang: "en" | "ml" | "manglish";
  text: string;
}

export const CORPUS: CorpusPrompt[] = [
  { tile: "hero", level: "vague", lang: "en", text: "make a nice banner for our fest" },
  { tile: "hero", level: "medium", lang: "manglish", text: "oru hero banner venam, heading 'IEDC Fest 2026', tagline 'Build. Break. Launch.', pinne oru register button um" },
  {
    tile: "hero",
    level: "detailed",
    lang: "en",
    text: "Create a hero banner with the heading 'IEDC Fest 2026', the tagline 'Build. Break. Launch.', a purple-to-orange gradient background and a 'Register now' button that links to the register section.",
  },

  { tile: "countdown", level: "vague", lang: "en", text: "add a countdown timer for the fest" },
  { tile: "countdown", level: "medium", lang: "ml", text: "ഫെസ്റ്റിന് ഒരു countdown വേണം: 15 Dec 2026 രാവിലെ 9 മണി വരെ. days, hours, minutes, seconds വെവ്വേറെ boxes ൽ, ഓരോ second ലും മാറണം" },
  {
    tile: "countdown",
    level: "detailed",
    lang: "en",
    text: "Show a countdown to 15 December 2026, 9:00 AM IST with separate labelled boxes for days, hours, minutes and seconds that update every second. When the time is over, show 'The fest is happening now!'.",
  },

  { tile: "schedule", level: "vague", lang: "en", text: "show the event schedule" },
  { tile: "schedule", level: "medium", lang: "manglish", text: "schedule cards venam: 09:30 Opening (IEDC Team), 10:30 Idea Pitch (Student Founders), 12:00 Build Workshop (Industry Mentor), 14:00 Demo Time (Participating Teams)" },
  {
    tile: "schedule",
    level: "detailed",
    lang: "en",
    text: "Make 4 session cards in a responsive grid. Each card shows the time, title and speaker: 09:30 Opening by IEDC Team; 10:30 Idea Pitch by Student Founders; 12:00 Build Workshop by Industry Mentor; 14:00 Demo Time by Participating Teams.",
  },

  { tile: "register", level: "vague", lang: "en", text: "make a registration form" },
  { tile: "register", level: "medium", lang: "manglish", text: "name, email, department ulla oru registration form. department dropdown il 5 departments venam. email thettanenkil error kaanikkanam" },
  {
    tile: "register",
    level: "detailed",
    lang: "en",
    text: "Build a registration form with name, email and a department dropdown (CSE, ECE, EEE, ME, Civil, IT). If the form is empty or the email is invalid, show an error message. If everything is correct, show 'Thanks, <name>!' instead.",
  },

  { tile: "theme", level: "vague", lang: "en", text: "add dark mode" },
  { tile: "theme", level: "medium", lang: "manglish", text: "oru button venam, click cheythal page full dark aakanam, veendum click cheythal light aakanam" },
  {
    tile: "theme",
    level: "detailed",
    lang: "en",
    text: "Add a button that toggles dark mode for the whole page by switching a 'dark' class on the body and changing the --bg, --fg and --card colour variables to dark colours. Clicking again switches back to light.",
  },

  { tile: "gallery", level: "vague", lang: "en", text: "make a photo gallery" },
  { tile: "gallery", level: "medium", lang: "en", text: "6 cards in a grid with an emoji and a caption each: Hackathon, Workshop, Demo Day, Mentor Talk, Pitch Night, Networking" },
  { tile: "gallery", level: "detailed", lang: "ml", text: "6 cards ഉള്ള ഒരു gallery grid: ഓരോ card ലും ഒരു emoji യും caption ഉം — Hackathon, Workshop, Demo Day, Mentor Talk, Pitch Night, Networking. hover ചെയ്യുമ്പോൾ card വലുതാകണം" },

  { tile: "feedback", level: "vague", lang: "en", text: "let people rate the fest" },
  { tile: "feedback", level: "medium", lang: "en", text: "5 stars. when I tap star 3, 3 stars light up and the text says 'You rated: 3/5'" },
  {
    tile: "feedback",
    level: "detailed",
    lang: "manglish",
    text: "5 star rating venam. oru star tap cheythal athu vare ulla ella stars um highlight aakanam, 'You rated: N/5' ennu kaanikkanam, pinne rate cheythal oru thank you message um varanam",
  },

  { tile: "fixit", level: "vague", lang: "en", text: "fix the bugs" },
  { tile: "fixit", level: "medium", lang: "en", text: "the like button doesn't increase the count" },
  {
    tile: "fixit",
    level: "detailed",
    lang: "manglish",
    text: "Like button click cheythal count koodunnilla. pinne email illathe subscribe cheythalum 'Subscribed!' ennu varunnu, athinu pakaram 'Please enter an email' kaanikkanam",
  },
];

/** What a student types after a failed Check: the checklist items that are still crossed out. */
export const followUp = (failing: string[]) => `It's not right yet. Please fix these:\n${failing.map((f) => `- ${f}`).join("\n")}`;
