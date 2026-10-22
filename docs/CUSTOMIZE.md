# Customising: every word and setting

Want to change some wording, a list or a number? Edit the right file below. **You never need to touch the app code.** Every screen (phones, host console, big screen, practice, landing page) and the arena server read from these files.

There are two places:

- **`colleges/<id>/college.ts`**: what's specific to *your* college. That's the name, logo text, "by …" sticker, departments and semesters. `pnpm new-college` creates it.
- **`config/`**: everything every college shares. That's game text, rules, scoring, timings and word lists.

> On the event laptop you can also change the college name, departments and semesters in the host console's **College** tab, with no code at all. That's saved on that laptop only (`arena-data/college.json`).

The files are TypeScript, but they're just text in quotes:

```ts
export const college: College = {
  organiser: "by IEDC",          // ← change the text between the quotes
  departments: ["CSE", "EC", "EEE"],
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
| App name, logo text, "by …" sticker, browser tab title, description, install name, default event name | `colleges/<id>/college.ts` |
| Departments and semesters on the join form (Dept wars uses the same list). Add `"Other"` to let students type their own. | `colleges/<id>/college.ts` |
| **The published monthly standings** (use `pnpm leaderboard`, see [LEADERBOARD.md](LEADERBOARD.md)) | `colleges/<id>/monthly.json` |
| Laptop address (192.168.137.1), port (4000), theme colour | `config/site.ts` |
| "developed by" footer credit (name, link) | `config/site.ts` → `credits` (photo: `apps/web/public/credits/developer.webp`) |
| Game names, one-liners, rules text, colours, default round times, game order | `config/games.ts` |
| Difficulty names, anagram pack names in the host dropdown, default custom words | `config/games.ts` |
| Points (solve, speed bonus, first blood, penalties), difficulty multipliers | `config/rules.ts` |
| Default playlist, knockout %, strike thresholds, countdown length | `config/rules.ts` |
| Anti-cheat timings (how often phones check for internet, the 1.5 s grace) | `config/rules.ts` |
| Student ID max length (`STUDENT_ID`), PIN length, wrong tries before lock, lock minutes (`PIN`) | `config/rules.ts` |
| How monthly points are counted (`MONTHLY.method`: total points or F1-style rank points), months shown | `config/rules.ts` |
| Internet-check URLs, hotspot network names ("Laptop hotspot"…) | `config/network.ts` |
| Home page headline, steps, feature blurbs | `config/copy/landing.ts` |
| Join form labels, placeholders and errors, Student ID hint, PIN screens and the "save your PIN" note | `config/copy/join.ts` |
| Student screens: lobby, countdown, playing, results, podium | `config/copy/play.ts` |
| Host console: buttons, confirms, tabs, cheat-sheet, Students, Monthly and College tabs | `config/copy/host.ts` |
| Monthly leaderboard page (title, "Last updated", month names, empty states) | `config/copy/leaderboard.ts` |
| Big screen / projector | `config/copy/screen.ts` |
| Practice room | `config/copy/practice.ts` |
| "Caught you online" screen, strike banners, host flag texts | `config/copy/anticheat.ts` |
| Live gossip feed ("First blood! …", "… joined the chaos") | `config/copy/feed.ts` |
| Server replies ("Slow down, speedrunner.", "Time's up!", join errors) | `config/copy/errors.ts` |
| Messages inside the games and game buttons | `config/copy/games.ts` |
| Funny podium titles | `config/copy/podium.ts` |
| Shared bits: live/offline, sound on/muted, tab names, 404 / offline pages, page titles | `config/copy/common.ts` |
| Word Hunt answers | `config/words/wordhunt-answers.txt` |
| Anagram word packs | `config/words/anagram-packs.source.json` |
| App icons | `apps/web/public/icons/` (regenerate with `pnpm --filter @iedc/web icons`) |

## Word lists

1. Edit `config/words/wordhunt-answers.txt` (one 5-letter word per line) or `config/words/anagram-packs.source.json` (packs of 3–8 letter words). A new pack also needs an entry in `ANAGRAM_PACK_OPTIONS` in `config/games.ts`.
2. Run `pnpm content:build`. This rebuilds `config/words/generated/`, adding the dictionary of valid guesses and the anagram alternates (so *notes* also accepts *stone*). Don't edit `generated/` by hand.

## After editing

- **Check for typos:** run `pnpm check`. A missing quote or comma is reported with the file and line.
- **Development:** `pnpm dev` picks up changes immediately.
- **Event laptop:** run `pnpm kit` again and copy the new `dist/event-kit-<id>/` folder over the old one. Your `arena-data/` is kept.
- **Online site:** push to `main` and Vercel redeploys.
