/**
 * Name, branding and basic settings of the whole platform.
 * Used by: browser tab title, install (PWA) name, landing page, host console, big screen.
 *
 * The college's own names (app name, logo text, organiser, descriptions, default
 * event name) come from its profile in colleges/<id>/college.ts. Everything
 * below is shared by every college.
 */
import { college } from "./college";

export const site = {
  appName: college.appName,
  shortName: college.shortName,
  brand: college.brand,
  organiser: college.organiser,
  titleTemplate: college.titleTemplate,
  defaultTitle: college.defaultTitle,
  description: college.description,
  manifestDescription: college.manifestDescription,
  defaultEventName: college.defaultEventName,
  /** Paper colour behind the app (browser bar / splash screen) */
  themeColor: "#fffbf2",
  /** The Windows laptop hotspot is always this address */
  defaultArenaAddress: "192.168.137.1",
  /** Port the arena server listens on */
  defaultPort: 4000,
  /** Developer credit in the page footers (photo: apps/web/public/credits/developer.webp) */
  credits: {
    label: "developed by",
    name: "Ajay Daniel Trevor",
    url: "https://ajaydanieltrevor.com",
  },
} as const;
