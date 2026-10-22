# Getting started: make it your college's

This guide takes you from nothing to your own event kit and website. No coding needed; you'll copy-paste a few commands.

> Just want to run one event with no website? Skip all this: download `event-kit-example.zip` from the repo's **Releases**, unzip it, and follow [EVENT_DAY.md](EVENT_DAY.md). Set your college name and departments in the host console's **College** tab.

## 1. Install the tools (once)

1. **Node.js 20 LTS or newer** from https://nodejs.org (the "LTS" button). Accept the defaults.
2. **pnpm**: open a terminal (Windows: *PowerShell*) and run:
   ```bash
   npm install -g pnpm
   ```
3. **Git** from https://git-scm.com (Windows), or use GitHub Desktop.

## 2. Get your own copy

1. On GitHub, click **Fork** on this repo. You now have your own copy under your account.
2. Download it to your computer:
   ```bash
   git clone https://github.com/<your-account>/<repo-name>.git
   cd <repo-name>
   pnpm install
   ```

## 3. Set up your college

```bash
pnpm new-college
```

It asks for:

| Question | Example |
|---|---|
| Your college or club name (shown as "by …") | `IEDC MEC` |
| Name of your tournament series | `Weekly Series` |
| Departments, separated by commas | `CSE, ECE, EEE, ME, CE` |
| Semesters or years | `S1, S2, S3, S4, S5, S6, S7, S8` |
| Short id for your college's folder | `iedc-mec` |

It creates `colleges/<id>/college.ts` and remembers your choice in `.env`. You can edit that file later; every field is explained in `config/college-types.ts`. More things to change: [CUSTOMIZE.md](CUSTOMIZE.md).

Check everything is in place:

```bash
pnpm check-setup
```

## 4. Try it

```bash
pnpm dev
```

- Home page: http://localhost:3000
- Host console: http://localhost:3000/host/ (the PIN is printed in the terminal)
- A "phone": http://localhost:3000/play/ in another browser tab

Stop it with **Ctrl+C**.

## 5. Build the event kit

```bash
pnpm kit
```

You get `dist/event-kit-<id>/` and `dist/event-kit-<id>.zip`. Copy either to the event laptop and follow [EVENT_DAY.md](EVENT_DAY.md).

## 6. Put the website online (optional, free)

The website gives students practice games and the monthly leaderboard.

1. Save your college to GitHub:
   ```bash
   git add colleges
   git commit -m "Add our college"
   git push
   ```
2. Go to https://vercel.com, sign in with GitHub, **Add New → Project**, and pick your fork.
3. **Root Directory:** `apps/web`. Leave the other settings alone.
4. **Environment Variables:** add `COLLEGE` with your college id (for example `iedc-mec`).
5. Click **Deploy**.

From now on, every `git push` updates the website.

## 7. After each event

1. On the laptop: **`BACKUP-DATA.bat`**, then copy `backups/` somewhere safe.
2. Publish the monthly leaderboard: [LEADERBOARD.md](LEADERBOARD.md).

Stuck? See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
