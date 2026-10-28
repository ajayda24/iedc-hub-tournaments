import type { Fragment } from "./state";

/**
 * Turns the AI's reply into a fragment (spec 6.3). Tolerant about fences and
 * stray wrappers, strict about anything that could reach the network.
 */

export const MAX_FRAGMENT_BYTES = 20 * 1024;
export const MAX_EXPLANATION = 280;

export type ParseResult = { ok: true; fragment: Fragment; explanation: string } | { ok: false; reason: string };

/** Patterns an answer may not contain anywhere (a second layer behind the sandbox). */
export const FORBIDDEN: { re: RegExp; label: string }[] = [
  { re: /<script[^>]*\bsrc\s*=/i, label: "<script src>" },
  { re: /\b(?:src|href|action|srcset|poster|data)\s*=\s*["']?\s*(?:https?:)?\/\//i, label: "external link" },
  { re: /url\(\s*["']?\s*(?:https?:)?\/\//i, label: "external url()" },
  { re: /@import\b/i, label: "@import" },
  { re: /\bfetch\s*\(/, label: "fetch(" },
  { re: /\bXMLHttpRequest\b/, label: "XMLHttpRequest" },
  { re: /\bWebSocket\b/, label: "WebSocket" },
  { re: /\bEventSource\b/, label: "EventSource" },
  { re: /\bimport\s*\(/, label: "import(" },
  { re: /\bimportScripts\b/, label: "importScripts" },
  { re: /\bsendBeacon\b/, label: "sendBeacon" },
  { re: /\beval\s*\(/, label: "eval(" },
  { re: /\bnew\s+Function\s*\(/, label: "new Function(" },
  { re: /document\s*\.\s*cookie/, label: "document.cookie" },
  { re: /window\s*\.\s*parent\b/, label: "window.parent" },
  { re: /window\s*\.\s*top\b/, label: "window.top" },
  { re: /\blocalStorage\b/, label: "localStorage" },
  { re: /\bsessionStorage\b/, label: "sessionStorage" },
];

const block = (text: string, tag: string): string | null => {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1] : null;
};

const stripFences = (s: string) => s.replace(/```[a-zA-Z]*\s*\n?/g, "").replace(/```/g, "");

/** Remove wrappers the AI was told not to write (<!doctype>, <html>, <body>, an outer <section>). */
function cleanHtml(html: string): string {
  let h = html.trim();
  h = h.replace(/<!doctype[^>]*>/gi, "").replace(/<\/?(?:html|head|body)\b[^>]*>/gi, "").trim();
  const outer = h.match(/^<section\b[^>]*>([\s\S]*)<\/section>$/i);
  if (outer && !/<section\b/i.test(outer[1])) h = outer[1].trim();
  return h;
}

/** <style> or <script> wrappers inside the css/js blocks. */
const unwrap = (s: string, tag: string) => s.replace(new RegExp(`^\\s*<${tag}[^>]*>([\\s\\S]*)<\\/${tag}>\\s*$`, "i"), "$1").trim();

/** The same safety rules for code a student edits by hand: size limit and the forbidden list. */
export function validateFragment(fragment: Fragment): { ok: true } | { ok: false; reason: string } {
  if (byteLength(fragment) > MAX_FRAGMENT_BYTES) return { ok: false, reason: "too big" };
  const all = `${fragment.html}\n${fragment.css}\n${fragment.js}`;
  const bad = FORBIDDEN.find((f) => f.re.test(all));
  return bad ? { ok: false, reason: `forbidden: ${bad.label}` } : { ok: true };
}

export function parseAnswer(raw: string): ParseResult {
  const text = stripFences(raw ?? "");
  // the html block is named like the tag, so find it from the outside: first <html>, last </html>
  const hStart = text.search(/<html>/i);
  const hEnd = text.toLowerCase().lastIndexOf("</html>");
  const html = hStart >= 0 && hEnd > hStart ? text.slice(hStart + 6, hEnd) : null;
  const css = block(text, "css");
  const js = block(text, "js");
  if (html == null && css == null && js == null) return { ok: false, reason: "no code blocks" };

  const fragment: Fragment = { html: cleanHtml(html ?? ""), css: unwrap(css ?? "", "style"), js: unwrap(js ?? "", "script") };
  if (byteLength(fragment) > MAX_FRAGMENT_BYTES) return { ok: false, reason: "too big" };
  const all = `${fragment.html}\n${fragment.css}\n${fragment.js}`;
  const bad = FORBIDDEN.find((f) => f.re.test(all));
  if (bad) return { ok: false, reason: `forbidden: ${bad.label}` };

  let explanation = text;
  if (hStart >= 0 && hEnd > hStart) explanation = explanation.slice(0, hStart) + explanation.slice(hEnd + 7);
  explanation = explanation
    .replace(/<css>[\s\S]*?<\/css>/gi, "")
    .replace(/<js>[\s\S]*?<\/js>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (explanation.length > MAX_EXPLANATION) explanation = `${explanation.slice(0, MAX_EXPLANATION - 1).trimEnd()}…`;
  return { ok: true, fragment, explanation };
}

function byteLength(f: Fragment): number {
  const enc = new TextEncoder();
  return enc.encode(f.html).length + enc.encode(f.css).length + enc.encode(f.js).length;
}
