import { frag, norm, text, type TileDefinition } from "../checks";

export const SESSIONS = [
  ["09:30", "Opening", "IEDC Team"],
  ["10:30", "Idea Pitch", "Student Founders"],
  ["12:00", "Build Workshop", "Industry Mentor"],
  ["14:00", "Demo Time", "Participating Teams"],
] as const;

const card = (time: string, title: string, speaker: string) =>
  `  <article class="card" data-hook="session-card">
    <span class="time" data-hook="session-time">${time}</span>
    <h3 data-hook="session-title">${title}</h3>
    <p data-hook="session-speaker">${speaker}</p>
  </article>`;

const html = (rows: readonly (readonly [string, string, string])[]) => `<h2>Schedule</h2>
<div class="cards">
${rows.map((r) => card(...r)).join("\n")}
</div>`;

const css = (layout = "display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px") => `#tile-schedule .cards{${layout}}
#tile-schedule .card{background:var(--card);border:2px solid var(--fg);border-radius:14px;padding:12px}
#tile-schedule .time{font-weight:800;color:var(--accent)}
#tile-schedule h3{margin:4px 0}`;

const TITLES = SESSIONS.map((s) => s[1].toLowerCase());

/** T3 Schedule. */
export const schedule: TileDefinition = {
  id: "schedule",
  starter: () => frag(""),
  reference: () => frag(html(SESSIONS), css()),
  bad: [
    { fails: "cards", fragment: frag(html([...SESSIONS.slice(0, 3), ["14:00", "Demo Time", ""]]), css()) },
    { fails: "cards", fragment: frag(html([...SESSIONS, ["16:00", "Demo Time", "Everyone"]]), css()) },
    { fails: "sessions", fragment: frag(html([...SESSIONS.slice(0, 3), ["14:00", "Lunch", "Participating Teams"]]), css()) },
    { fails: "grid", fragment: frag(html(SESSIONS), css("margin:0 auto")) },
  ],
  checks: {
    cards: {
      run: (p) => {
        const cards = p.hooks("session-card");
        return (
          cards.length === 4 &&
          cards.every((c) => {
            const q = (h: string) => c.querySelector(`[data-hook="${h}"]`);
            return /\d{1,2}[:.]\d{2}/.test(text(q("session-time"))) && !!text(q("session-title")) && !!text(q("session-speaker"));
          })
        );
      },
    },
    sessions: {
      run: (p) => {
        const titles = p.hooks("session-title").map((t) => norm(t.textContent)).join(" | ");
        return TITLES.every((t) => titles.includes(t));
      },
    },
    grid: { run: (p) => /\b(grid|flex)\b/i.test(p.css) },
  },
};
