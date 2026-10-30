import { frag, isClickable, luminance, type CheckPage, type TileDefinition } from "../checks";

const html = (tag = "button") => `<${tag} data-hook="theme-toggle"${tag === "button" ? ' type="button"' : ""} class="toggle">🌙 Dark mode</${tag}>`;

const css = (darkBg = "#14121a") => `body.dark{--bg:${darkBg};--fg:#f4f1ea;--card:#221f2b;--accent:#ff8a6b}
#tile-theme{text-align:center}
#tile-theme .toggle{padding:10px 18px;border-radius:999px;border:2px solid var(--fg);background:var(--card);color:var(--fg);font-weight:700;cursor:pointer}`;

const js = (toggle = true) => `(function () {
  var b = document.querySelector('#tile-theme [data-hook="theme-toggle"]');
  b.addEventListener("click", function () {
    var on = ${toggle ? 'document.body.classList.toggle("dark")' : 'document.body.classList.add("dark") || true'};
    b.textContent = on ? "☀️ Light mode" : "🌙 Dark mode";
  });
})();`;

/** Everything a theme switch could change: classes, data attributes and inline styles on <html>/<body>, and the colour variables. */
function snapshot(p: CheckPage) {
  const d = p.document;
  const el = (e: HTMLElement) => ({ cls: e.className, data: JSON.stringify({ ...e.dataset }), style: e.style.cssText });
  const cs = (e: Element, v: string) => p.window.getComputedStyle(e).getPropertyValue(v).trim();
  const bg = cs(d.body, "--bg") || cs(d.documentElement, "--bg") || p.window.getComputedStyle(d.body).backgroundColor;
  return {
    key: JSON.stringify({ html: el(d.documentElement), body: el(d.body), bg, fg: cs(d.body, "--fg") || cs(d.documentElement, "--fg") }),
    bg,
  };
}

const toggle = (p: CheckPage) => p.hook("theme-toggle");

/** T5 Dark/light switch. */
export const theme: TileDefinition = {
  id: "theme",
  starter: () => frag(""),
  reference: () => frag(html(), css(), js()),
  bad: [
    { fails: "button", fragment: frag(html("div"), css(), js()) },
    { fails: "dark", fragment: frag(html(), css("#ffffff"), js()) },
    { fails: "back", fragment: frag(html(), css(), js(false)) },
  ],
  checks: {
    button: { run: (p) => isClickable(toggle(p)) },
    dark: {
      run: (p) => {
        const s0 = snapshot(p);
        p.click(toggle(p));
        const s1 = snapshot(p);
        if (!toggle(p) || s1.key === s0.key) return false;
        const a = luminance(s0.bg);
        const b = luminance(s1.bg);
        return a == null || b == null || b < a;
      },
    },
    back: {
      run: (p) => {
        const s0 = snapshot(p);
        p.click(toggle(p));
        const s1 = snapshot(p);
        p.click(toggle(p));
        return !!toggle(p) && s1.key !== s0.key && snapshot(p).key === s0.key;
      },
    },
  },
};
