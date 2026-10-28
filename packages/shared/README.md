# `packages/shared`: the rules both sides agree on

Code used by both the arena (server) and the web app (phones, practice). No UI, no network.

| Path | What it is |
|---|---|
| `src/games/<id>/engine.ts` | One folder per game: generates a puzzle from a seed and checks answers. Each has an `engine.test.ts`. |
| `src/games/types.ts` | `GameDefinition`, the contract every game engine follows. |
| `src/games/registry.ts` | The list of games. A new game must be added here. |
| `src/games/meta.ts` | Game names and colours, read from `config/games.ts`. |
| `src/protocol.ts` | Every message between phones/host and the arena, and the state shapes. |
| `src/schemas.ts` | zod checks for everything a phone sends (the server never trusts a phone). |
| `src/scoring.ts` | Points: solve, speed bonus, first blood, penalties. |
| `src/monthly.ts` | Building the public monthly leaderboard from tournament history. |
| `src/rng.ts` | Seeded random numbers, so the same seed gives the same puzzle. |
| `src/competitions/` | Team competitions: the contract and registry; `vibecoding/` holds Vibe Hackathon's pure rules (`rules.ts`), scoring, views, schemas, the composer, the AI-answer parser, the puzzle and `tiles/` (starter, reference and bad fragments + checks for each tile). |
| `scripts/build-content.mjs` | `pnpm content:build`: rebuilds `config/words/generated/`. |

Adding a game: see [docs/ADD_A_GAME.md](../../docs/ADD_A_GAME.md).
