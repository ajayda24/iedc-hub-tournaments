# Monthly leaderboard data

`monthly.json` is what the public `/leaderboard` page shows on the website.

To publish new results:

1. On the event laptop, open the host console → **Monthly** tab → **Download for website**.
2. Replace this `monthly.json` with the downloaded file.
3. Commit and push. Vercel rebuilds and the page shows the new "last updated" time.

The file only holds names, departments, semesters and points. Student IDs and PINs never leave the laptop.
