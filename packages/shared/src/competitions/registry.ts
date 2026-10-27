import type { CompetitionMeta } from "./types";
import event from "@iedc/config/competitions/vibecoding/event.json";

/** Every competition the app knows. Light on purpose: the web pages import it to build their routes. */
export const COMPETITIONS: Record<string, CompetitionMeta> = {
  vibecoding: { id: event.id, title: event.title, subtitle: event.subtitle },
};

export const COMPETITION_IDS = Object.keys(COMPETITIONS);
export const isCompetitionId = (id: string) => Object.hasOwn(COMPETITIONS, id);
