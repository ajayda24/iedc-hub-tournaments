"use client";
import { VcPlayerApp } from "./vibecoding/PlayerApp";
import { VcHostApp } from "./vibecoding/HostApp";
import { VcScreenApp } from "./vibecoding/ScreenApp";

/** Each competition's three screens. A new competition adds a line here and a folder next to vibecoding/. */
const SCREENS = {
  vibecoding: { player: VcPlayerApp, host: VcHostApp, screen: VcScreenApp },
} as const;

export function CompetitionPage({ eventId, view }: { eventId: string; view: "player" | "host" | "screen" }) {
  const screens = SCREENS[eventId as keyof typeof SCREENS];
  if (!screens) return null;
  const Screen = screens[view];
  return <Screen />;
}
