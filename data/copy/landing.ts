/**
 * Home page (/). Shown online (Vercel) and on the event Wi-Fi.
 */
export const landing = {
  hostLink: "host console",
  /** Big headline. Each entry is one line; `highlight` gets the yellow marker */
  headline: [
    { text: "Logic games." },
    { highlight: "Live.", text: " Loud." },
    { text: "Zero Wi-Fi drama." },
  ] as { text: string; highlight?: string }[],
  intro: "The host taps start, the whole room gets the same puzzle at the same second, and the leaderboard does the trash talk.",

  // when the page is opened on the event Wi-Fi
  joinLive: "Join the live event →",
  onEventWifi: "you're on the event Wi-Fi",

  // when the page is opened online
  atEventTitle: "At an event?",
  atEventSteps: [
    "Join the event Wi-Fi (the host's hotspot)",
    "Turn off mobile data",
    "Scan the QR on the big screen — or type the address:",
  ],
  goButton: "Go",

  mascotNote: "this is Bulbu",

  practiceTitle: "Warm up solo",
  practiceLink: "practice →",
  practiceOfflineNote: "Practice works offline once this site is installed (Add to Home Screen).",

  /** three numbered blurbs at the bottom */
  features: [
    { title: "Same puzzle, same second", body: "Everyone's clock is synced to the host laptop. Fastest correct answer wins the most." },
    { title: "No internet. On purpose.", body: "The event runs on a hotspot with no internet. Phones caught online get frozen. Sorry, ChatGPT." },
    { title: "Department wars", body: "Every point counts for your department too. CSE vs Mech, settle it here." },
  ],
} as const;
