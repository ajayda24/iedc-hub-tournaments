import { frag, visible, type CheckPage, type TileDefinition } from "../checks";

const html = (stars = 5) => `<h2>Rate the fest</h2>
<div class="stars">
${Array.from({ length: stars }, (_, i) => `  <button type="button" class="star" data-hook="star" data-active="false" aria-label="${i + 1} stars">★</button>`).join("\n")}
</div>
<p data-hook="rating-text">Tap a star to rate</p>
<p class="thanks" data-hook="rating-thanks" hidden></p>`;

const css = `#tile-feedback{text-align:center}
#tile-feedback .star{font-size:2rem;background:none;border:0;color:#bbb;cursor:pointer}
#tile-feedback .star[data-active="true"]{color:#f5b301}
#tile-feedback .thanks{font-weight:700;color:var(--accent)}`;

const js = (opts: { only?: boolean; text?: boolean; thanks?: boolean } = {}) => `(function () {
  var root = document.getElementById("tile-feedback");
  var stars = root.querySelectorAll('[data-hook="star"]');
  var label = root.querySelector('[data-hook="rating-text"]');
  var thanks = root.querySelector('[data-hook="rating-thanks"]');
  stars.forEach(function (star, i) {
    star.addEventListener("click", function () {
      stars.forEach(function (s, j) { s.setAttribute("data-active", ${opts.only ? "j === i" : "j <= i"} ? "true" : "false"); });
      label.textContent = ${opts.text === false ? '"Thanks for rating!"' : '"You rated: " + (i + 1) + "/5"'};
      ${opts.thanks === false ? "" : 'thanks.textContent = "Thank you for your feedback! 💛"; thanks.hidden = false;'}
    });
  });
})();`;

const active = (p: CheckPage) => p.hooks("star").filter((s) => s.getAttribute("data-active") === "true").length;
const tap = (p: CheckPage, n: number) => p.click(p.hooks("star")[n - 1]);

/** T7 Feedback stars. */
export const feedback: TileDefinition = {
  id: "feedback",
  starter: () => frag(""),
  reference: (v) => (v === "simple" ? frag(html(), css, js({ thanks: false })) : frag(html(), css, js())),
  bad: [
    { fails: "stars", fragment: frag(html(6), css, js()) },
    { fails: "highlight", fragment: frag(html(), css, js({ only: true })) },
    { fails: "text", fragment: frag(html(), css, js({ text: false })) },
    { fails: "thanks", fragment: frag(html(), css, js({ thanks: false })) },
    { fails: "highlight", variant: "simple", fragment: frag(html(), css, js({ only: true, thanks: false })) },
  ],
  checks: {
    stars: { run: (p) => p.hooks("star").length === 5 },
    highlight: {
      run: (p) => {
        if (p.hooks("star").length < 5) return false;
        tap(p, 3);
        if (active(p) !== 3) return false;
        tap(p, 5);
        if (active(p) !== 5) return false;
        tap(p, 2);
        return active(p) === 2;
      },
    },
    text: {
      run: (p) => {
        if (p.hooks("star").length < 3) return false;
        tap(p, 3);
        if (!(p.hook("rating-text")?.textContent ?? "").includes("3")) return false;
        tap(p, 2);
        return (p.hook("rating-text")?.textContent ?? "").includes("2");
      },
    },
    thanks: {
      run: (p) => {
        if (p.hooks("star").length < 3) return false;
        tap(p, 3);
        return visible(p, p.hook("rating-thanks"));
      },
    },
  },
};
