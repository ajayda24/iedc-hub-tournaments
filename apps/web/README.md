# `apps/web`: everything on a screen

The Next.js app (static export + PWA). The same build runs on Vercel (landing, practice, leaderboard) and on the event laptop, served by the arena.

## Pages: `app/`

Each folder is one URL. The page files are thin; the real screen lives in `src/screens/`.

| URL | Who sees it | Screen |
|---|---|---|
| `/` | everyone | `src/screens/Landing.tsx` |
| `/play/` | students' phones | `src/screens/PlayApp.tsx` (join + PIN: `JoinForm.tsx`) |
| `/host/` | the host laptop | `src/screens/HostApp.tsx` (Students + Monthly tabs: `HostExtras.tsx`) |
| `/screen/` | the projector | `src/screens/ScreenApp.tsx` |
| `/practice/` | anyone, offline too | `src/screens/PracticeApp.tsx` |
| `/leaderboard/` | anyone | `src/screens/LeaderboardApp.tsx` |
| `/competitions/vibecoding/` (`host/`, `screen/`) | Vibe Hackathon: phones, host, wall | `src/competitions/vibecoding/` (`PlayerApp`, `HostApp`, `ScreenApp`) |

`layout.tsx` (fonts, PWA), `globals.css` (colours, notebook look), `manifest.ts` and `sw.ts` (the service worker) apply to every page.

## Code: `src/`

| Folder | What's in it |
|---|---|
| `screens/` | One file per page (see above). Start here when changing what a page does. |
| `games/` | One view per game (`QueensView.tsx`, …). `index.tsx` maps a game id to its view. |
| `ui/` | Reusable pieces: buttons and cards (`kit.tsx`), timer, leaderboard, podium, answer reveal, mascot, sounds. |
| `net/` | Talking to the arena: the socket connection and shared state (`arena.ts`), server-synced clock (`useNow.ts`). |
| `anticheat/` | Internet probe, leaving-the-tab strikes, and their overlays. |
| `lib/` | Small helpers: where the arena is (`arenaUrl.ts`), formatting, safe localStorage. |
| `pwa/` | Registers the service worker (online site only). |
| `competitions/` | Team competitions. `vibecoding/`: board, tile workspace, puzzle, publish, host console, projector wall, its own socket (`net.ts`). |

`@/…` in imports means `src/…`. All text comes from [`config/`](../../config/README.md), never hard-coded here.
