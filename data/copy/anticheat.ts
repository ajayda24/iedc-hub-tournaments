/**
 * Anti-cheat messages players see on their phones.
 */
export const anticheat = {
  // full-screen block when the phone can reach the internet
  caughtTitle: "Caught you",
  caughtHighlight: "online",
  caughtBody: "Your phone can reach the internet. That's not allowed during the event.",
  caughtSteps: ["Turn OFF mobile data", "Turn off any VPN", "Stay on the event Wi-Fi only"],
  caughtFooter: "The game unfreezes by itself once you're offline. The host has been told.",

  // banners for strikes (leaving the game during a round)
  strikes: {
    warn: { title: "Strike one!", body: "You left the game. Next time it costs 200 points." },
    penalty: { title: "−200 points", body: "Your brain left the tab. Stay put!" },
    lock: { title: "Locked out", body: "Too many strikes this round. Talk to the host." },
  },
  internetStrike: { title: "Internet detected", body: "That's a strike. Mobile data off, please." },
  /** how long the banner stays (seconds) */
  bannerSec: 5,
  lockBannerSec: 9,

  // what the host sees in the Flags tab
  flagInternet: "Device reached the internet (mobile data / VPN?)",
  flagLeft: (time: string, why?: string) => `Left the game for ${time}${why ? ` (${why})` : ""}`,
  leftApp: "switched app or tab",
  leftWindow: "left the window",
} as const;
