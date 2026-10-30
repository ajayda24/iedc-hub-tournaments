import { frag, norm, text, type TileDefinition } from "../checks";

export const CAPTIONS = ["Hackathon", "Workshop", "Demo Day", "Mentor Talk", "Pitch Night", "Networking"];
const EMOJI = ["💻", "🛠️", "🎤", "🧑‍🏫", "🌙", "🤝"];

const html = (captions = CAPTIONS) => `<h2>Gallery</h2>
<div class="grid">
${captions.map((c, i) => `  <figure class="card" data-hook="gallery-card"><div class="pic">${EMOJI[i % EMOJI.length]}</div><figcaption data-hook="gallery-caption">${c}</figcaption></figure>`).join("\n")}
</div>`;

const css = (hover = true) => `#tile-gallery .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
#tile-gallery .card{margin:0;background:var(--card);border:2px solid var(--fg);border-radius:14px;padding:12px;text-align:center;transition:transform .2s,box-shadow .2s}
${hover ? "#tile-gallery .card:hover{transform:scale(1.05);box-shadow:0 8px 20px rgba(0,0,0,.2)}\n" : ""}#tile-gallery .pic{font-size:2.6rem}
#tile-gallery figcaption{font-weight:700}`;

/** T6 Gallery. */
export const gallery: TileDefinition = {
  id: "gallery",
  starter: () => frag(""),
  reference: () => frag(html(), css()),
  bad: [
    { fails: "cards", fragment: frag(html([...CAPTIONS, "Snacks"]), css()) },
    { fails: "captions", fragment: frag(html(["Coding", ...CAPTIONS.slice(1)]), css()) },
    { fails: "hover", fragment: frag(html(), css(false)) },
  ],
  checks: {
    cards: {
      run: (p) => {
        const cards = p.hooks("gallery-card");
        return cards.length === 6 && cards.every((c) => !!text(c.querySelector('[data-hook="gallery-caption"]')));
      },
    },
    captions: {
      run: (p) => {
        const all = p.hooks("gallery-caption").map((c) => norm(c.textContent));
        return CAPTIONS.every((c) => all.some((x) => x.includes(c.toLowerCase())));
      },
    },
    hover: { run: (p) => /:hover[^{]*\{[^}]*\b(transform|box-shadow|scale|filter|background)/i.test(p.css) },
  },
};
