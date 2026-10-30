import { TASKS, tileConfig, type ScoredTileId, type TileId } from "./config";
import type { Fragment } from "./state";

/**
 * Builds the one-page site from the tile fragments. The same function feeds the
 * phone preview, the check runner and the published site, so what students see
 * is exactly what is checked and published.
 */

export const SHELL_CSS = `:root{--bg:#fffdf7;--fg:#1d1b16;--accent:#ff6b4a;--card:#ffffff}
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--fg);line-height:1.5}
section{padding:24px 16px;max-width:960px;margin:0 auto}
.coming-soon{border:2px dashed currentColor;border-radius:14px;padding:18px;text-align:center;opacity:.55;font-weight:600}`;

/** Blocks network access for previews and published sites (jsdom ignores it; the checks stub the network instead). */
export const PAGE_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:";

export interface ComposeOptions {
  /** <title> of the page */
  title?: string;
  /** which tiles get a section, in page order (default: all 8) */
  tiles?: TileId[];
  /** show a "coming soon" box for tiles that have no html yet */
  placeholders?: boolean;
  /** add the CSP meta tag (previews and published sites) */
  csp?: boolean;
}

const safeCss = (css: string) => css.replace(/<\/style/gi, "<\\/style");

/* ---------------- keeping each tile's CSS inside its own section ---------------- */

/** At-rules whose blocks hold ordinary rules (scoped like the rest). Others (@keyframes, @font-face…) are left alone. */
const NESTING_AT_RULES = /^@(media|supports|container|layer|document)\b/i;

/** Split on commas that are not inside (), [] or strings: `a, :is(b, c)` → ["a", ":is(b, c)"]. */
function splitSelectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let cur = "";
  for (const ch of list) {
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

/**
 * Make one selector apply only inside #tile-<id>:
 *   `.card`            → `#tile-hero .card`
 *   `body`, `:root`    → `#tile-hero`             (page-wide styles stay in the section)
 *   `body.dark .card`  → `body.dark #tile-hero .card`   (dark-mode rules keep working)
 *   `#tile-hero h1`    → unchanged
 * The theme tile may still style <html>/<body> (its job is the page's colours).
 */
function scopeSelector(sel: string, id: string): string {
  const own = `#tile-${id}`;
  if (sel === own || sel.startsWith(`${own} `) || sel.startsWith(`${own}.`) || sel.startsWith(`${own}:`) || sel.startsWith(`${own}[`) || sel.startsWith(`${own}>`)) return sel;
  const page = sel.match(/^(html|body|:root)([.#:[][^\s>+~]*)?(?=$|[\s>+~])/i);
  if (page) {
    if (id === "theme") return sel;
    const rest = sel.slice(page[0].length).trim();
    if (!rest) return own;
    // `body > x` / `body x` → keep the page part (it may carry a dark-mode class), then the section
    return `${page[0]} ${own} ${rest.replace(/^[>+~]\s*/, "")}`;
  }
  return `${own} ${sel}`;
}

/** Scope every rule of a tile's CSS to its own section (inside @media too; @keyframes untouched). */
export function scopeCss(css: string, id: string): string {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let out = "";
  let i = 0;
  while (i < src.length) {
    // the prelude: up to "{" or ";" (outside strings and brackets)
    let j = i;
    let quote = "";
    let paren = 0;
    while (j < src.length) {
      const ch = src[j];
      if (quote) {
        if (ch === quote) quote = "";
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "(") paren++;
      else if (ch === ")") paren--;
      else if (paren === 0 && (ch === "{" || ch === ";" || ch === "}")) break;
      j++;
    }
    const prelude = src.slice(i, j).trim();
    if (j >= src.length) {
      out += src.slice(i);
      break;
    }
    if (src[j] !== "{") {
      // a statement like @charset "x"; or a stray "}"
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    // the block: to the matching "}"
    let k = j + 1;
    let depth = 1;
    quote = "";
    while (k < src.length && depth > 0) {
      const ch = src[k];
      if (quote) {
        if (ch === quote) quote = "";
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "{") depth++;
      else if (ch === "}") depth--;
      k++;
    }
    const body = src.slice(j + 1, k - 1);
    if (prelude.startsWith("@")) out += NESTING_AT_RULES.test(prelude) ? `${prelude}{${scopeCss(body, id)}}\n` : `${prelude}{${body}}\n`;
    else if (prelude) out += `${splitSelectors(prelude).map((s) => scopeSelector(s, id)).join(", ")}{${body}}\n`;
    i = k;
  }
  return out;
}
const safeJs = (js: string) => js.replace(/<\/script/gi, "<\\/script");

export function compose(fragments: Partial<Record<TileId, Fragment>>, opts: ComposeOptions = {}): string {
  const tiles = opts.tiles ?? (TASKS.pageOrder as TileId[]);
  const sections = tiles.map((id) => {
    const f = fragments[id];
    const html = f?.html.trim() ? f.html : opts.placeholders ? `<div class="coming-soon">${tileConfig(id).emoji} ${tileConfig(id).title}: coming soon</div>` : "";
    const anchor = id === "register" ? `<a id="register" aria-hidden="true"></a>\n` : "";
    return `${anchor}<section id="tile-${id}">\n${html}\n</section>`;
  });
  const styles = tiles
    .filter((id) => fragments[id]?.css.trim())
    .map((id) => `<style data-tile="${id}">\n${safeCss(scopeCss(fragments[id]!.css, id))}\n</style>`);
  const scripts = tiles
    .filter((id) => fragments[id]?.js.trim())
    .map((id) => `<script data-tile="${id}">\n${safeJs(fragments[id]!.js)}\n</script>`);
  const csp = opts.csp ? `<meta http-equiv="Content-Security-Policy" content="${PAGE_CSP}">\n` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${csp}<title>${escapeHtml(opts.title ?? TASKS.event.name)}</title>
<style>
${SHELL_CSS}
</style>
${styles.join("\n")}
</head>
<body>
${sections.join("\n")}
${scripts.join("\n")}
</body>
</html>
`;
}

/** The whole site from a team's 8 tile fragments. */
export function composeSite(fragments: Record<ScoredTileId, Fragment>, opts: Omit<ComposeOptions, "tiles"> = {}) {
  return compose(fragments, opts);
}

/** A short fingerprint of the 8 tiles' code: "has the page changed since it was published?" */
export function siteHash(fragments: Partial<Record<TileId, Fragment>>): string {
  const text = (TASKS.pageOrder as TileId[]).map((id) => {
    const f = fragments[id];
    return f ? `${f.html}\u0000${f.css}\u0000${f.js}` : "";
  }).join("\u0001");
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
