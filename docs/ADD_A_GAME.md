# Adding a game

Every game is a pure engine in `packages/shared` (runs on the laptop) plus a view in `apps/web` (runs on the phone). N-Queen (`queens`) is a good, small example to copy.

## Checklist

1. **The id.** Add it to `GameId` in `packages/shared/src/games/types.ts`, and to `GameKey` in `config/games.ts`. If it needs a new highlighter colour, add it to `GameColor`/`ColorKey`, to `COLOR` in `apps/web/src/ui/kit.tsx`, and as `--color-<name>` in `apps/web/app/globals.css`.
2. **The text.** In `config/games.ts`: title, tagline, how-to, colour, default round times, and the id in `GAME_ORDER`. Messages shown inside the game go in `config/copy/games.ts`.
3. **The engine.** `packages/shared/src/games/<id>/engine.ts`, exporting a `GameDefinition`:
   - `generate(seed, difficulty)` → `{ pub, secret }`. Same seed, same puzzle. `pub` goes to phones; `secret` (the answer) never leaves the laptop.
   - `initialProgress(pub)`, and `check(pub, secret, progress, submission)` → `solved | progress | wrong | invalid | failed`. Set `penalty: true` on wrong checks that should cost points.
   - `partialCredit(...)` → 0..1 when time runs out. Make sure spamming can't farm it.
   - `reveal(...)` → what's shown after the round. If no existing `Reveal` kind fits, add one in `types.ts` and draw it in `apps/web/src/ui/Reveal.tsx`.
   - `subSchema`: a zod schema for what the phone sends, with size limits.
4. **Tests.** `packages/shared/src/games/<id>/engine.test.ts`: generation is valid and deterministic, `check` accepts the answer and rejects wrong ones, partial credit behaves.
5. **Register it** in `packages/shared/src/games/registry.ts`, and add the id to the `game` enum in `roundConfigSchema` in `packages/shared/src/schemas.ts`.
6. **The view.** `apps/web/src/games/<Name>View.tsx`, taking `ViewProps<Pub, Progress>`. Autosave with `submit({ ..., final: false })`, check with `final: true`. Add it to `VIEWS` in `apps/web/src/games/index.tsx`.
7. **Bots** (optional, for load tests): teach `apps/arena/scripts/bots.ts` to play it.
8. **An e2e round** (optional): copy "a live N-Queen round" in `e2e/event.spec.ts`.

## Before you push

```bash
pnpm check
pnpm build
pnpm test:e2e
```

The new game then shows up on the home page, in the practice room and in the host playlist automatically.
