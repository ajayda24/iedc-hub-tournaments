# Adding a competition

A **competition** is a long, team-based event that runs next to the weekly games, with its own pages, Socket.IO namespace and saved data. Vibe Hackathon (`vibecoding`) is the first one; copy its shape.

| Layer | Vibe Hackathon | A new competition `<id>` |
|---|---|---|
| Registry | `packages/shared/src/competitions/registry.ts` | add `<id>: { id, title, subtitle }` |
| Rules (pure, tested) | `packages/shared/src/competitions/vibecoding/` (`state.ts`, `rules.ts`, `scoring.ts`, `views.ts`, `schemas.ts`, `protocol.ts`) | `packages/shared/src/competitions/<id>/`, implementing `CompetitionDefinition` from `../types.ts` |
| Text and numbers | `config/competitions/vibecoding/*.json`, `config/copy/vibecoding.ts` | `config/competitions/<id>/`, `config/copy/<id>.ts` |
| Server room | `apps/arena/src/competitions/vibecoding/room.ts` | `apps/arena/src/competitions/<id>/room.ts`, mounted in `apps/arena/src/competitions/index.ts` (`rooms`) |
| Saved data | `arena-data/competitions/vibecoding/` | `arena-data/competitions/<id>/` (use `CompetitionStore` or copy it) |
| Phone, host, wall | `apps/web/src/competitions/vibecoding/` | `apps/web/src/competitions/<id>/`, added to `SCREENS` in `apps/web/src/competitions/index.tsx` |
| Pages | `apps/web/app/competitions/[eventId]/…` | nothing: the pages are built for every id in the registry |

## How the pieces talk

1. A phone opens `/competitions/<id>/` and connects to the `/competitions` namespace with `hello { competition: "<id>", role }`.
2. The namespace hands the socket to that competition's room.
3. The room turns messages into **actions** for the pure `applyAction(state, action, ctx)`. Anything slow (AI calls, checks, files) happens in the room, and its result goes back in as another action.
4. After every change the room pushes views (`wall`, `team`, `host`) and saves the state (debounced, atomic).

Keep every rule in the pure layer: it's what the unit tests cover, and what makes restarts safe.

## Before you push

```bash
pnpm check
pnpm build
pnpm test:e2e
```
