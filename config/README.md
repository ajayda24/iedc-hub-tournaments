# `data/` — every word and setting in Brain Arena

Want to change some wording, a list or a number? Edit the right file here. **You never need to touch the app code.** Every screen (phones, host console, big screen, practice, landing page) and the arena server read from this folder.

The files are TypeScript, but they're just text in quotes:

```ts
export const site = {
  appName: "Brain Arena",          // ← change the text between the quotes
  organiser: "by IEDC",
};
```

Some entries are small functions for text that includes a value. Keep the `${...}` parts and edit the words around them:

```ts
youreIn: "You're in,",
roundOf: (n: number, total: number) => `round ${n} of ${total}`,
```

## Where to change what

| I want to change… | File |
|---|---|
| App name, logo text, "by IEDC" sticker, browser tab title, description, install name, theme colour | `site.ts` |
| Default event name, laptop address (192.168.137.1), port (4000) | `site.ts` |
| "developed by" footer credit (name, link) | `site.ts` → `credits` (photo: `apps/web/public/credits/developer.webp`) |
| Departments and semesters on the join form (Dept wars uses the same list) | `people.ts` |
| Game names, one-liners, rules text, colours, default round times, game order | `games.ts` |
| Difficulty names, anagram pack names in the host dropdown, default custom words | `games.ts` |
| Points (solve, speed bonus, first blood, penalties), difficulty multipliers | `rules.ts` |
| Default playlist, knockout %, strike thresholds, countdown length | `rules.ts` |
| Anti-cheat timings (how often phones check for internet, the 1.5 s grace) | `rules.ts` |
| Student ID max length (`STUDENT_ID`), PIN length, wrong tries before lock, lock minutes (`PIN`) | `rules.ts` |
| How monthly points are counted (`MONTHLY.method`: total points or F1-style rank points), months shown | `rules.ts` |
| Internet-check URLs, hotspot network names ("Laptop hotspot"…) | `network.ts` |
| Home page headline, steps, feature blurbs | `copy/landing.ts` |
| Join form labels, placeholders and errors, Student ID hint, PIN screens and the "save your PIN" note | `copy/join.ts` |
| Student screens: lobby, countdown, playing, results, podium | `copy/play.ts` |
| Host console: buttons, confirms, tabs, cheat-sheet, Students tab (reset PIN), Monthly tab | `copy/host.ts` |
| Monthly leaderboard page (title, "Last updated", month names, empty states) | `copy/leaderboard.ts` |
| **The published monthly standings** (replace with the host's download, see below) | `leaderboard/monthly.json` |
| Big screen / projector | `copy/screen.ts` |
| Practice room | `copy/practice.ts` |
| "Caught you online" screen, strike banners, host flag texts | `copy/anticheat.ts` |
| Live gossip feed ("First blood! …", "… joined the chaos") | `copy/feed.ts` |
| Server replies ("Slow down, speedrunner.", "Time's up!", join errors) | `copy/errors.ts` |
| Messages inside the games and game buttons | `copy/games.ts` |
| Funny podium titles | `copy/podium.ts` |
| Shared bits: live/offline, sound on/muted, tab names, 404 / offline pages, page titles | `copy/common.ts` |
| Word Hunt answers | `words/wordhunt-answers.txt` |
| Anagram word packs | `words/anagram-packs.source.json` |

## Word lists

1. Edit `words/wordhunt-answers.txt` (one 5-letter word per line) or `words/anagram-packs.source.json` (packs of 3–8 letter words; a new pack also needs an entry in `ANAGRAM_PACK_OPTIONS` in `games.ts`).
2. Run `pnpm content:build`. This rebuilds `words/generated/`, which adds the dictionary of valid guesses and the anagram alternates (so *notes* also accepts *stone*). Don't edit `generated/` by hand.

## Publishing the monthly leaderboard

There's no database. The event laptop keeps every tournament in `arena-data/history.json`, and the website shows `leaderboard/monthly.json`:

1. Host console → **Monthly** tab → tick or untick tournaments → **Download for website**.
2. Replace `data/leaderboard/monthly.json` with the downloaded file, commit and push to `main`.
3. Vercel rebuilds; `/leaderboard` shows the new standings and the "Last updated" time.

The file has names, departments, semesters and points only, never Student IDs or PINs. **Backup history** (in the same tab) does include Student IDs, so keep it private and never commit it.

## After editing

- **Development:** `pnpm dev` picks up changes immediately.
- **Event laptop:** run `pnpm pack:arena` again and copy the new `dist/brain-arena` folder.
- **Online site:** push to `main` and Vercel redeploys.
- **Check for typos:** run `pnpm typecheck`. A missing quote or comma is reported with the file and line.
