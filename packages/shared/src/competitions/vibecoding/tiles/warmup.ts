import { frag, norm, type TileDefinition } from "../checks";
import { escapeHtml } from "../composer";

/** Warm-up (unscored): the heading shows the team name. */
export const warmup: TileDefinition = {
  id: "warmup",
  starter: () => frag(""),
  reference: (_v, teamName) => frag(`<h1 data-hook="warmup-title">${escapeHtml(teamName)}</h1>`, `#tile-warmup h1{color:var(--accent)}`),
  bad: [{ fails: "title", fragment: frag(`<h1 data-hook="warmup-title">My Team</h1>`) }],
  checks: {
    title: { run: (p) => !!p.teamName && norm(p.hook("warmup-title")?.textContent).includes(norm(p.teamName)) },
  },
};
