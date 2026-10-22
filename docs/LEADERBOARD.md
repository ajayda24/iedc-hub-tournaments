# Publishing the monthly leaderboard

There's no database. Two files do the job:

| File | Where | What's in it | Public? |
|---|---|---|---|
| `arena-data/history.json` | the event laptop | every tournament, with Student IDs | **No.** Keep it on the laptop and in your private backups. |
| `colleges/<id>/monthly.json` | this repo | names, departments, semesters and points per month | Yes. The website's `/leaderboard` shows it. |

On the event Wi-Fi, `/leaderboard` is live from the laptop. The website shows whatever `monthly.json` you last published.

## After each event

1. Host console → **Monthly** tab. Tick or untick the tournaments that should count, and rename them if you like.
2. Click **Download for website**. You get a `monthly.json` file.
3. Copy it to the computer with the project, and in the project folder run:
   ```bash
   pnpm leaderboard "C:\Users\you\Downloads\monthly.json"
   ```
   This checks the file, copies it to `colleges/<id>/monthly.json` and shows the top 3 so you can sanity-check. It **refuses** a file that would remove tournaments already on the website (see below), or a private history backup with Student IDs in it.
4. Publish:
   ```bash
   git add colleges
   git commit -m "Update monthly leaderboard"
   git push
   ```
   Vercel rebuilds; `/leaderboard` shows the new standings and the "Last updated" time.

## "This file would remove N tournaments"

The laptop's history doesn't have a tournament that's already on the website. That happens when:

- you switched laptops or kits without copying `arena-data/`, or
- `arena-data/` was deleted.

Fix it on the laptop, then download again:

- If you have a **Backup history** file or a `backups/` copy, use Monthly → **Import backup**, or copy the old `arena-data` folder back into the kit.
- If you don't, ask in the repo's issues; a tournament can be rebuilt from the published `monthly.json` (see `apps/arena/scripts/recover-first-tournament.ts` for how IEDC did it).

Only add `--force` if removing those tournaments is really what you want.

## How points add up

- `MONTHLY.method` in `config/rules.ts` is either `"points"` (add up each student's scores) or `"rankPoints"` (F1-style: 25, 18, 15… per tournament).
- Students are matched across tournaments by Student ID. The public file only has an anonymous key, never the ID.
