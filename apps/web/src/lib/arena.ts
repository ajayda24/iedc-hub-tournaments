import { site } from "@iedc/data/site";

/** Where is the arena server? Same origin when the laptop serves the app. */
export function arenaUrl(): string {
  const env = process.env.NEXT_PUBLIC_ARENA_URL;
  if (env) return env;
  if (typeof window === "undefined") return "";
  const { protocol, hostname, port } = window.location;
  // `pnpm dev`: Next on :3000, arena on :4000
  if (port === "3000") return `${protocol}//${hostname}:${site.defaultPort}`;
  return window.location.origin;
}

const PRIVATE = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^127\./, /^localhost$/, /\.local$/];

/** True when this page was served by an arena laptop on the event network. */
export function isArenaOrigin(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname, port } = window.location;
  return PRIVATE.some((r) => r.test(hostname)) || port === String(site.defaultPort);
}
