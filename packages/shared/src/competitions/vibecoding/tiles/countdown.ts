import { frag, numberIn, type CheckPage, type TileDefinition } from "../checks";

/** Load time for "it counts down to 15 Dec 2026, 9:00 AM": exactly 2 d 2 h 30 m 0 s before. */
export const CD_T1 = "2026-12-13T06:30:00+05:30";
/** One second after the fest starts. */
export const CD_T2 = "2026-12-15T09:00:01+05:30";

const BOXES = [
  ["cd-days", "Days"],
  ["cd-hours", "Hours"],
  ["cd-minutes", "Minutes"],
  ["cd-seconds", "Seconds"],
] as const;

const html = (opts: { labels?: boolean; seconds?: boolean } = {}) => {
  const boxes = BOXES.filter(([h]) => opts.seconds !== false || h !== "cd-seconds")
    .map(([h, label]) => `  <div class="box"><span class="num" data-hook="${h}">0</span>${opts.labels === false ? "" : `<small>${label}</small>`}</div>`)
    .join("\n");
  return `<h2>Fest starts in</h2>
<div class="boxes">
${boxes}
</div>
<p class="msg" data-hook="cd-message"></p>`;
};

const css = `#tile-countdown{text-align:center}
#tile-countdown .boxes{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
#tile-countdown .box{background:var(--card);border:2px solid var(--fg);border-radius:12px;padding:10px 14px;min-width:72px}
#tile-countdown .num{display:block;font-size:2rem;font-weight:800}
#tile-countdown small{text-transform:uppercase;font-size:.7rem;letter-spacing:.08em}
#tile-countdown .msg{font-weight:800;color:var(--accent)}`;

const js = (opts: { now?: boolean; interval?: boolean; message?: boolean; seconds?: boolean } = {}) => `(function () {
  var root = document.getElementById("tile-countdown");
  var target = new Date("2026-12-15T09:00:00+05:30").getTime();
  function q(h) { return root.querySelector('[data-hook="' + h + '"]'); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function tick() {
    var ms = Math.max(0, target - Date.now());
    var s = Math.floor(ms / 1000);
    q("cd-days").textContent = Math.floor(s / 86400);
    q("cd-hours").textContent = pad(Math.floor((s % 86400) / 3600));
    q("cd-minutes").textContent = pad(Math.floor((s % 3600) / 60));
    ${opts.seconds === false ? "" : 'q("cd-seconds").textContent = pad(s % 60);'}
    ${opts.message === false ? "" : 'q("cd-message").textContent = ms === 0 ? "The fest is happening now! 🎉" : "";'}
  }
  ${opts.now === false ? "" : "tick();"}
  ${opts.interval === false ? "" : "setInterval(tick, 1000);"}
})();`;

const read = (p: CheckPage, hooks: string[]) => hooks.map((h) => numberIn(p.hook(h)));
const happening = (p: CheckPage) => /happening/i.test(p.hook("cd-message")?.textContent ?? "");

/** T2 Countdown. */
export const countdown: TileDefinition = {
  id: "countdown",
  starter: () => frag(""),
  reference: (v) => (v === "simple" ? frag(html({ seconds: false }), css, js({ seconds: false, message: false })) : frag(html(), css, js())),
  bad: [
    // only updates after the first second: wrong at load
    { fails: "target", fragment: frag(html(), css, js({ now: false })) },
    { fails: "labels", fragment: frag(html({ labels: false }), css, js()) },
    { fails: "ticking", fragment: frag(html(), css, js({ interval: false })) },
    { fails: "message", fragment: frag(html(), css, js({ message: false })) },
    { fails: "target", variant: "simple", fragment: frag(html({ seconds: false }), css, js({ now: false, seconds: false, message: false })) },
  ],
  checks: {
    target: {
      start: CD_T1,
      run: (p) => {
        p.clock.advance(0);
        const simple = !p.hook("cd-seconds");
        const [d, h, m, s] = read(p, ["cd-days", "cd-hours", "cd-minutes", "cd-seconds"]);
        if (d !== 2 || h !== 2 || m !== 30) return false;
        if (simple) return true;
        return s === 0 && !happening(p);
      },
    },
    labels: {
      start: CD_T1,
      run: (p) =>
        (
          [
            ["cd-days", /day/i],
            ["cd-hours", /hour/i],
            ["cd-minutes", /min/i],
            ["cd-seconds", /sec/i],
          ] as const
        ).every(([h, re]) => re.test(p.hook(h)?.parentElement?.textContent ?? "")),
    },
    ticking: {
      start: CD_T1,
      run: (p) => {
        p.clock.advance(1000);
        const [m, s] = read(p, ["cd-minutes", "cd-seconds"]);
        return s === 59 && m === 29;
      },
    },
    message: {
      start: CD_T2,
      run: (p) => {
        p.clock.advance(1000);
        return read(p, ["cd-days", "cd-hours", "cd-minutes", "cd-seconds"]).every((n) => n === 0) && happening(p);
      },
    },
  },
};
