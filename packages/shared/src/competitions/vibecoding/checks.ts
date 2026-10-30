import type { TileId } from "./config";
import type { Fragment } from "./state";

/**
 * The page a check runs against. The arena builds it with jsdom (scripts on,
 * network stubbed, a fake clock), one fresh page per checklist item.
 */
export interface CheckPage {
  window: Window & typeof globalThis;
  document: Document;
  /** the tile's <section id="tile-<id>"> */
  section: HTMLElement | null;
  /** first / all elements with data-hook=<name> inside the section (or the whole page for page-level hooks) */
  hook(name: string): HTMLElement | null;
  hooks(name: string): HTMLElement[];
  /** the tile's own CSS (all tiles' CSS for page checks) */
  css: string;
  /** the tile's own HTML (for inline style="" checks) */
  html: string;
  clock: {
    now(): number;
    /** jump to a time without running timers */
    set(t: number | string): void;
    /** move time forward, running timers that fall due */
    advance(ms: number): void;
  };
  /** uncaught script errors so far */
  errors: string[];
  teamName: string;
  click(el: Element | null | undefined): void;
  /** fire a cancelable submit event (no browser validation popups), then fall back to clicking its button */
  submit(form: Element | null | undefined): void;
  /** set an input/select value and fire input + change */
  setValue(el: Element | null | undefined, value: string): void;
}

export interface CheckItem {
  /** fake clock time when the page loads (ISO string). Default: 2026-12-01T10:00:00+05:30 */
  start?: string;
  run(p: CheckPage): boolean;
}

export interface TileDefinition {
  id: TileId;
  /** what the tile starts with (Fix-it has planted bugs) */
  starter(variant: "full" | "simple"): Fragment;
  /** passes every check (Safe Mode, "Show me", tests). Warm-up needs the team name. */
  reference(variant: "full" | "simple", teamName: string): Fragment;
  /** bad fragments: each fails exactly the named checklist item (tests) */
  bad: { fails: string; variant?: "full" | "simple"; fragment: Fragment }[];
  checks: Record<string, CheckItem>;
}

export const DEFAULT_CHECK_START = "2026-12-01T10:00:00+05:30";

/* ---------------- helpers the checks share ---------------- */

/** Lower-case, collapse whitespace, unify quotes. */
export const norm = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

/** The first integer in an element's text ("02", "2 days" → 2). NaN if none. */
export const numberIn = (el: Element | null | undefined) => {
  const m = text(el).match(/-?\d+/);
  return m ? Number(m[0]) : Number.NaN;
};

/** Visible = has text, no `hidden` (on it or an ancestor), not display:none / visibility:hidden. */
export function visible(p: CheckPage, el: Element | null | undefined): boolean {
  if (!el || !text(el)) return false;
  for (let n: Element | null = el; n && n !== p.document.documentElement; n = n.parentElement) {
    if ((n as HTMLElement).hidden || n.getAttribute("aria-hidden") === "true") return false;
    const cs = p.window.getComputedStyle(n);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
  }
  return true;
}

export const isClickable = (el: Element | null | undefined) =>
  !!el && (el.tagName === "BUTTON" || el.tagName === "A" || (el.tagName === "INPUT" && /^(button|submit)$/i.test((el as HTMLInputElement).type)) || el.getAttribute("role") === "button");

/** #rgb / #rrggbb / rgb() / rgba() → relative luminance 0..1, or null if unparseable. */
export function luminance(color: string): number | null {
  const c = color.trim().toLowerCase();
  let rgb: number[] | null = null;
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((x) => x + x).join("") : hex[1];
    rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const fn = c.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (fn) rgb = [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  if (!rgb) {
    const named: Record<string, number[]> = { white: [255, 255, 255], black: [0, 0, 0] };
    rgb = named[c] ?? null;
  }
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const frag = (html: string, css = "", js = ""): Fragment => ({ html, css, js });
