# `colleges/`: one folder per college

Each folder is one college's profile:

| File | What it is |
|---|---|
| `college.ts` | name, logo text, "by …" sticker, page titles, default event name, departments, semesters |
| `monthly.json` | the monthly leaderboard shown on the website (publish it with `pnpm leaderboard <file>`) |

- `example/` is the neutral default, used when no college is chosen.
- `iedc/` is IEDC's, where this project started.

**Make your own:** `pnpm new-college` asks a few questions and creates `colleges/<id>/`.

**Which one is used?** The `COLLEGE` environment variable (set it on Vercel), else `COLLEGE=` in the `.env` file at the repo root (written by `pnpm new-college`), else `example`.
