# Vibe Hackathon: rehearsals and calibration

The automated tests cover the software. These checks need real people, phones and the event laptop (spec 16.7–16.10). Tick them off in order; fix what you find, then re-run the affected tests (`pnpm check`, `pnpm test:e2e`).

## Commands

```bash
pnpm vibecoding:models     # which Gemini models your key can use; one test request each
pnpm vibecoding:quality    # 24 beginner prompts per model (≈ 25 min); writes docs/competitions/vibecoding-quality.md
pnpm vibecoding:quality -- --gateway        # the same through the real gateway (failover), as on event day
pnpm vibecoding:quality -- --simple countdown,register   # try a tile's simple variant
pnpm vibecoding:bots       # 15 simulated teams + a forced restart, mock AI; prints the load budgets
pnpm vibecoding:bots -- --arena dist/brain-arena/arena.mjs   # the same against a packed kit
```

The key comes from `GEMINI_API_KEY`, or the file the host console saves (`arena-data/competitions/vibecoding/gemini-key.txt`).

## 1. Usability test (spec 16.7)

Three beginners from **non-CS departments**, the real laptop, their own phones. You only watch.

- [ ] They join, make a team and finish the **warm-up** without help: Ask, Save Point, Go Back.
- [ ] Each passes **tile 1 within 12 minutes**, then tiles 2 and 3 unaided.
- [ ] Nobody is confused by the words (Ask, Save Point, Go Back, Project Notes, Publish).
- [ ] Note every place they hesitated. Fix the wording in `config/copy/vibecoding.ts` or the tile text in `config/competitions/vibecoding/tasks.json`.

## 2. Hardware and network rehearsal (spec 16.8)

The real router and the event laptop, **at least 20 real phones**.

- [ ] Network set up as in the event-day guide (Ethernet with a static IP and no gateway, Wi-Fi for internet, ports 4000 and 4001 open).
- [ ] Every phone joins; note how long joining takes and whether any drop off the Wi-Fi.
- [ ] A phone **with mobile data on**: its Asks are blocked, and the host console shows "has internet" in the People tab.
- [ ] **Pull the laptop's internet** mid-build: Asks keep working through **Safe Mode** (backup answers), and it switches back when the internet returns.
- [ ] **Laptop thermals** over 90 minutes: plugged in, sleep off, High performance; it stays responsive.
- [ ] The **projector wall** is readable from the back row, and nothing depends on colour alone (every stage has an icon).
- [ ] Published sites open on phones (port 4001) and in the `/sites/` gallery.

## 3. Full dress rehearsal (spec 16.9)

One full-length run: **at least 5 real teams (~15 people)**, the real Gemini key, the final scoring.

- [ ] Every team reaches **Publish**.
- [ ] Mid-event, close the arena window and start it again: nothing is lost (spec 16.10).
- [ ] Export the results (Control → Export results) and keep the CSV.

### Calibrating the team-size factors (spec 10.6)

`config/competitions/vibecoding/scoring.json` → `sizeFactor` (`"2": 0.85, "3": 1.0, "4": 1.15`) is a first guess. From the dress-rehearsal `results.csv`:

1. For each team size, take the average **Publish (min)** of teams of similar skill.
2. Change the factors so the **Publish adjusted (min)** averages land within **15 %** of each other.
3. The bots (`pnpm vibecoding:bots`) also print raw and adjusted times per size; they are equally skilled by design, so they are a second opinion, not the answer.

## 4. Acceptance (spec 16.10)

- [ ] `pnpm check` and `pnpm test:e2e` green **three runs in a row**.
- [ ] The quality gate is met (`docs/competitions/vibecoding-quality.md`).
- [ ] The size-fairness criterion is met after calibration.
- [ ] The dress rehearsal: every team published; no data lost after a forced restart.
- [ ] `pnpm vibecoding:bots` budgets met **on the event laptop** (CPU < 40 %, RAM < 500 MB, wall p95 < 1 s, checks p95 < 1.5 s).

Set the event date only after all of this is green, with 2–3 days of buffer.
