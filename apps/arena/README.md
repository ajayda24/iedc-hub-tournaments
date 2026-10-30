# `apps/arena`: the event laptop's server

Fastify + Socket.IO. It serves the web build to phones over the hotspot, runs the rounds, checks every answer and saves everything to `arena-data/`.

## `src/`

| File | What it does |
|---|---|
| `index.ts` | Start-up: reads the flags (`--port`, `--pin`, `--data`, `--fresh`), serves the web files and the `/api/*` endpoints, prints the banner. |
| `arena.ts` | The tournament itself: lobby, rounds, scoring, knockout, strikes, podium. Pure logic, no network. |
| `realtime.ts` | Socket.IO: turns phone/host messages into `arena.ts` calls and sends state back. |
| `students.ts` | Student ID + PIN registry (`arena-data/students.json`, scrypt-hashed PINs). |
| `history.ts` | Finished tournaments for the monthly board (`arena-data/history.json`). |
| `persist/store.ts` | Crash safety: `snapshot.json` + `events.jsonl`, restored on restart. |
| `net/` | Network names/QR addresses and the laptop's own internet check. |
| `recover.ts` | One-off: rebuilds the lost 9 Oct 2026 tournament (used by `pnpm recover:first`). |
| `competitions/` | Team competitions on the `/competitions` namespace. `vibecoding/` (Vibe Hackathon): `room.ts` (sockets, Ask/Check/Publish), `store.ts` (saving), `ai/` (Gemini client, mock, gateway, prompt), `checks/` (jsdom check runner in worker threads), `sites.ts` (published sites on port 4001). |

## Other folders

- `test/`: unit tests (`pnpm test`).
- `scripts/bots.ts`: simulated students for load tests (`pnpm bots --n 80`).
- `scripts/recover-first-tournament.ts`: the `pnpm recover:first` command.
- `build.mjs`: bundles the server into one `arena.mjs` file for the event kit, plus `checks-worker.cjs` (the Vibe Hackathon check runner).
- `scripts/vibecoding-*.ts`: Vibe Hackathon tools: `models` (probe the AI), `quality` (24-prompt test), `bots` (load test).

## `arena-data/`

Created when the server runs (gitignored). From source it's `apps/arena/arena-data/`; in the event kit it's `dist/brain-arena/arena-data/`. **That folder holds the real event data: never delete it.**
