# Troubleshooting

Start with:

```bash
pnpm check-setup
```

It checks your tools, college, builds, port 4000 and data folders, and says how to fix what's wrong.

Problems on the event day itself (hotspot, phones, firewall) are in [EVENT_DAY.md](EVENT_DAY.md#troubleshooting).

## Setup and building

| Problem | Fix |
|---|---|
| `pnpm` is not recognised | `npm install -g pnpm`, then open a new terminal. |
| `No college profile "xyz"` | The `COLLEGE` in `.env` (or the environment) names a folder that isn't in `colleges/`. Run `pnpm new-college`, or fix the name. |
| Vercel build: `COLLEGE is not set` | Vercel → Project → Settings → Environment Variables → add `COLLEGE` = your college id, then redeploy. |
| The site still shows "Example College" | You're on the default college. Run `pnpm new-college` (local), or set `COLLEGE` (Vercel). |
| Type errors after editing a file in `colleges/` or `config/` | A missing quote, comma or bracket. The error names the file and line. |
| `pnpm dev` says port 4000 or 3000 is in use | Another arena or dev server is still running. Close that window, or restart the computer. |

## Data

| Problem | Fix |
|---|---|
| Where is my data? | `pnpm check-setup` lists every `arena-data` folder. On the laptop, it's next to the .bat files, and the start window prints it as **Data folder**. |
| Students' PINs or old tournaments are missing after updating the kit | The new kit has its own empty `arena-data`. Copy the old kit's `arena-data` folder into the new kit folder, then start again. |
| `pnpm leaderboard` refuses the file | The laptop's history is missing tournaments that are already on the website. See [LEADERBOARD.md](LEADERBOARD.md#this-file-would-remove-n-tournaments). |
| I need a backup now | Laptop: `BACKUP-DATA.bat`. From source: `pnpm backup`. Either way, copy `backups/` off the computer too. |

## Still stuck?

Open an issue on GitHub. Include what you ran, what you expected, and the full error text.
