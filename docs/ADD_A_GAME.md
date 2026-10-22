# Adding a game

Every game is a pure engine on the server plus a view on the phone. N-Queen (`queens`) is a good, small example to copy.

## Checklist

1. **The id.** Add it to `GameId` in `packages/shared/src/games/types.ts`, and to `GameKey` in `config/games.ts`. If it needs a new highlighter colour, add it to `GameColor`/`ColorKey`, to `COLOR` in `apps/web/src/ui/kit.tsx`, and as `--color-<name>` in `apps/web/app/globals.css`.
2. **The text.** In `config/games.ts`, add the title, tagline, how-to, colour and default round times, and put the id in `GAME_ORDER`. Messages shown inside the game go in `config/copy/games.ts`.
3. **The engine.** Create `packages/shared/src/games/<id>/engine.ts` exporting a `GameDefinition`:
   - `generate(seed, difficulty)` → `{ pub, secret }`. It must be deterministic for a seed. `pub` goes to phones; `secret` (the answer) never leaves the laptop.
   - `initialProgress(pub)`, `check(pub, secret, progress, submission)` → `solved | progress | wrong | invalid | failed`. Set `penalty: true` on wrong guesses that should cost points.
   - `partialCredit(...)` → 0..1 when time runs out. Make sure spamming can't farm it.
   - `reveal(...)` → what's shown after the round. If none of the existing `Reveal` kinds fit, add one in `types.ts` and render it in `apps/web/src/ui/Reveal.tsx`.
   - `subSchema`: a zod schema for what the phone sends, with sensible size limits.
4. **Tests.** `packages/shared/src/games/<id>/engine.test.ts`: generation is valid and deterministic, `check` accepts the answer and rejects wrong ones, partial credit behaves.
5. **Register it** in `packages/shared/src/games/registry.ts`, and add the id to the `game` enum in `roundConfigSchema` in `packages/shared/src/schemas.ts`.
6. **The view.** `apps/web/src/games/<Name>View.tsx`, taking `ViewProps<Pub, Progress>`. Autosave with `submit({ ..., final: false })` and check with `final: true`. Then add it to `VIEWS` in `apps/web/src/games/index.tsx`.
7. **Bots** (optional, for load tests): teach `apps/arena/scripts/bots.ts` to play it.
8. **An e2e round** (optional): see "a live N-Queen round" in `e2e/event.spec.ts`.

Then run:

```bash
pnpm check
pnpm build
pnpm test:e2e
```

The new game shows up in the home page, practice room and host playlist automatically.
