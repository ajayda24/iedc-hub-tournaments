/**
 * Name, branding and basic settings of the whole platform.
 * Used by: browser tab title, install (PWA) name, landing page, host console, big screen.
 */
export const site = {
  /** Shown in the browser tab, the install prompt and page headers */
  appName: "IEDC Weekly Series",
  /** Short name under the app icon on phones */
  shortName: "IEDC Weekly Series",
  /** The landing-page logo is written as `brand.left` + "/" + `brand.right` */
  brand: { left: "Weekly", right: "Series" },
  /** Small sticker next to the logo */
  organiser: "by IEDC",
  /** Browser tab title suffix, e.g. "Play · Brain Arena" */
  titleTemplate: "%s · Weekly Series",
  /** Browser tab title for the home page */
  defaultTitle: "Weekly Series · IEDC",
  /** Search engines and link previews */
  description: "Live logic-game tournaments for IEDC events. Works fully offline on the event Wi-Fi.",
  /** Description shown in the "install app" sheet */
  manifestDescription: "Live logic-game tournaments for IEDC events.",
  /** Paper colour behind the app (browser bar / splash screen) */
  themeColor: "#fffbf2",
  /** Event name used until the host renames it in Event settings */
  defaultEventName: "Weekly Series",
  /** The Windows laptop hotspot is always this address */
  defaultArenaAddress: "192.168.137.1",
  /** Port the arena server listens on */
  defaultPort: 4000,
} as const;
