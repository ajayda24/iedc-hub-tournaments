import { frag, norm, numberIn, visible, type CheckPage, type TileDefinition } from "../checks";

const html = (heading = true) => `<div class="corner">
  ${heading ? "<h2>Community corner</h2>\n  " : ""}<p>Liked the fest? Tell us!</p>
  <button type="button" data-hook="like-btn">👍 Like</button>
  <span data-hook="like-count" id="like-count">0</span>
  <form data-hook="news-form" novalidate>
    <p>Get fest updates:</p>
    <input data-hook="news-email" type="email" placeholder="you@example.com">
    <button type="submit">Subscribe</button>
    <p class="err" data-hook="news-error" hidden></p>
    <p class="ok" data-hook="news-success" hidden></p>
  </form>
</div>`;

const css = `#tile-fixit .corner{background:var(--card);border:2px solid var(--fg);border-radius:14px;padding:16px}
#tile-fixit button{padding:8px 14px;border-radius:999px;border:2px solid var(--fg);background:var(--bg);color:var(--fg);font-weight:700}
#tile-fixit input{padding:8px;border-radius:8px;border:1px solid #999;font:inherit}
#tile-fixit .err{color:#c0392b;font-weight:700}
#tile-fixit .ok{color:#1e8449;font-weight:700}`;

/** bugA: the Like handler writes to the wrong id. bugB: an empty email is accepted. */
const js = (opts: { bugA?: boolean; bugB?: boolean; success?: string } = {}) => `(function () {
  var root = document.getElementById("tile-fixit");
  var likes = 0;
  root.querySelector('[data-hook="like-btn"]').addEventListener("click", function () {
    likes++;
    var el = document.getElementById("${opts.bugA ? "likes-count" : "like-count"}");
    if (el) el.textContent = likes;
  });
  var form = root.querySelector('[data-hook="news-form"]');
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = root.querySelector('[data-hook="news-email"]').value.trim();
    var err = root.querySelector('[data-hook="news-error"]');
    var ok = root.querySelector('[data-hook="news-success"]');
    ${
      opts.bugB
        ? ""
        : `if (!email) {
      err.textContent = "Please enter an email"; err.hidden = false; ok.hidden = true;
      return;
    }`
    }
    err.hidden = true;
    ok.textContent = "${opts.success ?? "Subscribed!"}"; ok.hidden = false;
  });
})();`;

const submitWith = (p: CheckPage, email: string) => {
  p.setValue(p.hook("news-email"), email);
  p.submit(p.hook("news-form") ?? p.hook("news-email")?.closest("form"));
};

/** T8 Fix-it: a pre-built section with planted bugs (only Bug A in the simple variant). */
export const fixit: TileDefinition = {
  id: "fixit",
  starter: (v) => frag(html(), css, js({ bugA: true, bugB: v !== "simple" })),
  reference: () => frag(html(), css, js()),
  bad: [
    { fails: "like", fragment: frag(html(), css, js({ bugA: true })) },
    { fails: "empty", fragment: frag(html(), css, js({ bugB: true })) },
    { fails: "valid", fragment: frag(html(), css, js({ success: "Done" })) },
    { fails: "intact", fragment: frag(html(false), css, js()) },
    { fails: "like", variant: "simple", fragment: frag(html(), css, js({ bugA: true })) },
  ],
  checks: {
    like: {
      run: (p) => {
        const before = numberIn(p.hook("like-count"));
        p.click(p.hook("like-btn"));
        p.click(p.hook("like-btn"));
        return Number.isFinite(before) && numberIn(p.hook("like-count")) === before + 2;
      },
    },
    empty: {
      run: (p) => {
        submitWith(p, "");
        const err = p.hook("news-error");
        return visible(p, err) && norm(err?.textContent).includes("please enter an email");
      },
    },
    valid: {
      run: (p) => {
        submitWith(p, "asha@example.com");
        const ok = p.hook("news-success");
        return visible(p, ok) && norm(ok?.textContent).includes("subscribed!");
      },
    },
    intact: { run: (p) => !!p.section?.querySelector("h1,h2,h3,h4,h5,h6") && !!p.hook("like-btn") && !!p.hook("news-email") },
  },
};
