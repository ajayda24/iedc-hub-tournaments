import { frag, norm, isClickable, type TileDefinition } from "../checks";

const html = (title: string, tagline: string, cta: string, ctaTag = "a") =>
  `<div class="hero">
  <h1 data-hook="hero-title">${title}</h1>
  <p data-hook="hero-tagline">${tagline}</p>
  <${ctaTag} data-hook="hero-cta" class="cta"${ctaTag === "a" ? ' href="#register"' : ""}>${cta}</${ctaTag}>
</div>`;

const css = (bg: string) => `#tile-hero .hero{background:${bg};color:#fff;padding:48px 20px;border-radius:18px;text-align:center}
#tile-hero h1{font-size:2.4rem;margin:0}
#tile-hero p{font-size:1.2rem;margin:8px 0 0}
#tile-hero .cta{display:inline-block;margin-top:18px;padding:12px 22px;border-radius:999px;background:#fff;color:#1d1b16;font-weight:700;text-decoration:none}`;

const GRADIENT = "linear-gradient(135deg,var(--accent),#7b5cff)";

/** T1 Hero banner. */
export const hero: TileDefinition = {
  id: "hero",
  starter: () => frag(""),
  reference: () => frag(html("IEDC Fest 2026", "Build. Break. Launch.", "Register now"), css(GRADIENT)),
  bad: [
    { fails: "title", fragment: frag(html("IEDC Fest", "Build. Break. Launch.", "Register now"), css(GRADIENT)) },
    { fails: "tagline", fragment: frag(html("IEDC Fest 2026", "Build and launch", "Register now"), css(GRADIENT)) },
    { fails: "gradient", fragment: frag(html("IEDC Fest 2026", "Build. Break. Launch.", "Register now"), css("#7b5cff")) },
    { fails: "cta", fragment: frag(html("IEDC Fest 2026", "Build. Break. Launch.", "Join us"), css(GRADIENT)) },
    { fails: "cta", fragment: frag(html("IEDC Fest 2026", "Build. Break. Launch.", "Register now", "span"), css(GRADIENT)) },
  ],
  checks: {
    title: { run: (p) => norm(p.hook("hero-title")?.textContent).includes("iedc fest 2026") },
    tagline: { run: (p) => norm(p.hook("hero-tagline")?.textContent).includes("build. break. launch.") },
    gradient: { run: (p) => /(linear|radial|conic)-gradient\(/i.test(`${p.css}\n${p.html}`) },
    cta: {
      run: (p) => {
        const el = p.hook("hero-cta");
        return !!el && (el.tagName === "A" || isClickable(el)) && /register/i.test(el.textContent ?? "");
      },
    },
  },
};
