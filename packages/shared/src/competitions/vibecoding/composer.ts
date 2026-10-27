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
    .map((id) => `<style data-tile="${id}">\n${safeCss(fragments[id]!.css)}\n</style>`);
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

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
