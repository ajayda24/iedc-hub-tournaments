import { describe, expect, it } from "vitest";
import { parseAnswer, FORBIDDEN, MAX_FRAGMENT_BYTES } from "./parser";
import { compose } from "./composer";
import { generatePuzzle, isSolved, neighbours, optimalMoves, piecesInPlace, slide, SOLVED } from "./puzzle";
import { TASKS, TILE_IDS } from "./config";
import { referenceFragment } from "./tiles/index";

describe("parser (spec 6.3)", () => {
  it("extracts the three blocks and a short explanation", () => {
    const r = parseAnswer(`Here you go! The hero is ready.\n<html><h1 data-hook="hero-title">Hi</h1></html>\n<css>#tile-hero h1{color:red}</css>\n<js></js>`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fragment.html).toBe(`<h1 data-hook="hero-title">Hi</h1>`);
    expect(r.fragment.css).toBe("#tile-hero h1{color:red}");
    expect(r.fragment.js).toBe("");
    expect(r.explanation).toBe("Here you go! The hero is ready.");
  });

  it("tolerates fences, missing blocks, wrappers and upper case tags", () => {
    const r = parseAnswer("```html\n<HTML><section id=\"tile-hero\"><p>x</p></section></HTML>\n```\n```\n<JS><script>console.log(1)</script></JS>\n```");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fragment.html).toBe("<p>x</p>");
    expect(r.fragment.js).toBe("console.log(1)");
    expect(r.fragment.css).toBe("");
  });

  it("keeps inner html even when it contains nested tags named like blocks", () => {
    const r = parseAnswer("<html><div><code>&lt;css&gt;</code></div></html><css>a{b:c}</css>");
    expect(r.ok && r.fragment.html).toBe("<div><code>&lt;css&gt;</code></div>");
  });

  it("rejects answers with no blocks, oversized answers and every forbidden pattern", () => {
    expect(parseAnswer("Sorry, I can't help with that.").ok).toBe(false);
    expect(parseAnswer(`<html>${"x".repeat(MAX_FRAGMENT_BYTES + 1)}</html>`).ok).toBe(false);
    const samples: Record<string, string> = {
      "<script src>": `<html><script src="a.js"></script></html>`,
      "external link": `<html><img src="https://x.y/a.png"></html>`,
      "external url()": `<css>a{background:url(https://x/y.png)}</css>`,
      "@import": `<css>@import "x.css";</css>`,
      "fetch(": `<js>fetch("/x")</js>`,
      XMLHttpRequest: `<js>new XMLHttpRequest()</js>`,
      WebSocket: `<js>new WebSocket("ws://x")</js>`,
      EventSource: `<js>new EventSource("/x")</js>`,
      "import(": `<js>import("x")</js>`,
      importScripts: `<js>importScripts("x")</js>`,
      sendBeacon: `<js>navigator.sendBeacon("/x")</js>`,
      "eval(": `<js>eval("1")</js>`,
      "new Function(": `<js>new Function("return 1")</js>`,
      "document.cookie": `<js>document.cookie</js>`,
      "window.parent": `<js>window.parent.x</js>`,
      "window.top": `<js>window.top.x</js>`,
      localStorage: `<js>localStorage.x=1</js>`,
      sessionStorage: `<js>sessionStorage.x=1</js>`,
    };
    for (const f of FORBIDDEN) {
      const r = parseAnswer(samples[f.label]);
      expect({ label: f.label, ok: r.ok, reason: r.ok ? "" : r.reason }).toEqual({ label: f.label, ok: false, reason: `forbidden: ${f.label}` });
    }
    // anchors to the page itself are fine
    expect(parseAnswer(`<html><a href="#register">Register now</a></html>`).ok).toBe(true);
  });

  it("caps the explanation", () => {
    const r = parseAnswer(`${"word ".repeat(200)}<html><p>x</p></html>`);
    expect(r.ok && r.explanation.length).toBeLessThanOrEqual(280);
  });
});

describe("composer", () => {
  const refs = Object.fromEntries(TILE_IDS.map((id) => [id, referenceFragment(id, "full")]));

  it("puts the 8 sections in page order, CSS and JS per tile", () => {
    const html = compose(refs);
    const order = [...html.matchAll(/<section id="tile-(\w+)">/g)].map((m) => m[1]);
    expect(order).toEqual(TASKS.pageOrder);
    expect(html).toContain('<a id="register"');
    expect(html.match(/<style data-tile=/g)).toHaveLength(8);
    expect(html.match(/<script data-tile=/g)!.length).toBeGreaterThanOrEqual(5);
  });

  it("shows placeholders for unfinished tiles, and escapes closing tags in CSS/JS", () => {
    const html = compose({ hero: { html: "", css: "a{}</style><b>", js: "var s='</script>'" } }, { placeholders: true, csp: true });
    expect(html).toContain("coming soon");
    expect(html).toContain("<\\/style");
    expect(html).toContain("<\\/script");
    expect(html).toContain("Content-Security-Policy");
  });

  it("reference CSS is scoped to its own section (no collisions)", () => {
    for (const id of TILE_IDS) {
      const css = refs[id].css.replace(/\/\*[\s\S]*?\*\//g, "");
      const selectors = [...css.matchAll(/(^|})\s*([^{}@]+)\{/g)].map((m) => m[2].trim());
      for (const sel of selectors) for (const part of sel.split(",")) expect({ id, part: part.trim(), ok: /^(#tile-\w+|body\.|:root|html)/.test(part.trim()) }).toMatchObject({ ok: true });
    }
  });
});

describe("sliding puzzle (spec 8)", () => {
  it("is seeded, solvable and 8–14 moves from solved", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const a = generatePuzzle(seed);
      expect(generatePuzzle(seed)).toEqual(a);
      expect(isSolved(a.board)).toBe(false);
      expect(a.optimal).toBeGreaterThanOrEqual(8);
      expect(a.optimal).toBeLessThanOrEqual(14);
      expect(optimalMoves(a.board)).toBe(a.optimal);
      expect([...a.board].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    }
  });

  it("only slides pieces next to the empty slot", () => {
    const b = SOLVED.slice();
    expect(slide(b, 7)).toEqual([1, 2, 3, 4, 5, 6, 7, 0, 8]);
    expect(slide(b, 5)).toEqual([1, 2, 3, 4, 5, 0, 7, 8, 6]);
    expect(slide(b, 0)).toBeNull();
    expect(slide(b, 8)).toBeNull();
    expect(neighbours(4).sort()).toEqual([1, 3, 5, 7]);
  });

  it("partial credit counts pieces in place", () => {
    expect(piecesInPlace(SOLVED)).toBe(8);
    expect(piecesInPlace([0, 2, 3, 4, 5, 6, 7, 8, 1])).toBe(7);
  });
});
