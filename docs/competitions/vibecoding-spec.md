> **How this spec maps onto the repo** (decided 2026-10-28; the rest of the text is the original spec):
> - The competition id is `vibecoding`: pages at `/competitions/vibecoding/` (phones), `/competitions/vibecoding/host/` and `/competitions/vibecoding/screen/`. "Tile Rush" is its display title.
> - `data/events/tile-rush/*.json` → `config/competitions/vibecoding/*.json`; student-facing text in `config/copy/vibecoding.ts`.
> - `data/runs/<event-id>/` → `arena-data/competitions/vibecoding/runs/<run-id>/` (private, gitignored).
> - Code folders `events/tile-rush/` → `competitions/vibecoding/`; Socket.IO namespace `/events` → `/competitions`.
> - The quality kit (16.6) is not a separate folder: `pnpm vibecoding:quality` runs the app's own tiles, check runner and parser.
> - The Gemini key: `GEMINI_API_KEY`, or pasted in the host console (saved in `arena-data/competitions/vibecoding/gemini-key.txt`).

# Tile Rush: Full Specification, Build Plan and Test Plan

This is the complete version of the event. It replaces the earlier "Lite" plan (`tile-rush-build-plan-v2.md`). Everything below is in scope unless it is listed in section 1.3.

Source of truth for the existing app is the repo README (`github.com/ajayda24/iedc-hub-tournaments`). Gate 0 confirms the real integration points before any refactor.

---

## 1. Overview

### 1.1 The event in one paragraph
Teams of 2-4 students register on the local network and race to build one project, the **IEDC Fest Page**, using only their phones. Each team has a **3x3 board** with 8 locked tiles and one empty slot. Every tile is a small web-page task done by **asking an AI** in plain language (English, Malayalam or Manglish). Passing a tile's hidden checks reveals one piece of a picture. When all 8 tiles are done, the pieces are scrambled and the team solves a **sliding puzzle**. Solving it unlocks **Publish**, which puts the team's site live on the local network. After publishing, a "client" sends a **change request**. Everything is scored on time, efficiency, process habits and the finished product, and shown live on the big screen.

### 1.2 Decisions
| Item | Decision |
|---|---|
| Scale | 10-15 teams, 2-4 members each (up to about 60 phones), phones only |
| Registration | In the app, over the local network, with member details |
| AI | **Google Gemini API only**: Gemma 4 26B and 31B first, then Gemini 3.1 and 3.5 Flash-Lite. No other provider, no local model |
| Network | Router with no internet for students; laptop on the router by ethernet and on Wi-Fi for internet (reaches Gemini) |
| Leaderboard | Not connected to the monthly leaderboard or Dept wars. Results are exported to disk; decide later |
| Window | 100-minute build clock (default), plus an optional showcase, review and prizes session |
| Event date | To be set after Gate 6 (see section 17) |

### 1.3 Out of scope
Any AI provider other than the Gemini API; a local model; monthly leaderboard / Dept wars integration; a code editor for students (they can only view code read-only).

### 1.4 Friendly vocabulary (real terms are revealed at the end)
| Students see | Real term |
|---|---|
| Ask | Prompt |
| Project Notes | Context |
| Save Point | Git commit |
| Go Back | Revert |
| Publish | Deploy |
| Tile | Feature / task |
| Check | Automated test |

Store these in `data/events/tile-rush/vocabulary.json`.

---

## 2. Event timeline and states

### 2.1 Global states (host controls the transitions)
`SETUP` -> `REGISTRATION` -> `WARMUP` -> `BUILD` -> `FROZEN` -> `SHOWCASE` -> `CLOSED`

| State | What happens |
|---|---|
| SETUP | Host configures clock length, glitch on/off, team limits |
| REGISTRATION | Teams and members register. Opens when the host opens it (doors open) |
| WARMUP | Unscored practice tile: students learn Ask, Save Point, Go Back. Asks are free and do not count |
| BUILD | The clock runs. All 8 tiles, puzzle, publish and change request are live |
| FROZEN | Clock ends: no more Asks, moves or publishes. Partial credit is calculated. Published sites stay online |
| SHOWCASE | Site gallery, host demo mode, audience voting, awards |
| CLOSED | Results exported, event archived |

Host can **Pause/Resume** the clock during BUILD (blocks Asks and puzzle moves) and **Extend** it by N minutes.

### 2.2 Per-team stages
`REGISTERED` -> `READY` -> `TILES` -> `PUZZLE` -> `PUBLISHED` -> `CHANGE_REQUEST` -> `DONE`

### 2.3 Suggested run of show (build 10:30-12:30)
| Time | Segment |
|---|---|
| By 10:00 | Registration open as students arrive |
| 10:30 | Kickoff and rules |
| 10:40 | WARMUP |
| 10:50-12:30 | BUILD (100 minutes) |
| 12:30 | FROZEN, break |
| 1:30-2:30 (optional) | SHOWCASE: demos, prompt and glossary reveal, voting, prizes |

---

## 3. Player experience (phone)

### 3.1 Screens
1. **Join**: existing form (full name, Student ID, semester, department) and 4-digit PIN.
2. **Team**: create a team (name up to 24 characters, unique) and get a 4-character **team code**, or join with a code.
3. **Lobby**: member list, ready button, event state, joining QR is not needed.
4. **Board**: 3x3 grid with this team's tiles in a **per-team shuffled order** (seeded). Each tile shows its state: locked/open/in progress (with member name)/done (with its picture piece). Shows clock, score, rank, Ask cooldown, Asks used.
5. **Tile workspace**:
   - Brief and **checklist** (3-4 requirements, each with a tick or cross after a check)
   - **Ask box** (max 600 characters), **Preview** (this section; button for "full page")
   - **Save Point**, **Go Back** (list of Save Points and auto-saves), **Project Notes** (shared team note), **Hint**, **See code** (read-only), **Check**
6. **Puzzle**: sliding puzzle, move counter and timer.
7. **Publish**: runs the site check, shows the result, publishes and shows the site link and QR.
8. **Change request**: client message, then back to the workspace.
9. **Done**: team summary (timeline, badges) and the glossary reveal.

### 3.2 Rules that shape the experience
- A tile can be **opened by one member at a time** (soft lock, released after 3 minutes idle or on close). Others can watch.
- Members work in parallel on different tiles.
- Check is free, with a 5-second cooldown per tile. It never reveals hidden selectors, only the checklist items that pass or fail.
- Ask responses can be in English, Malayalam or Manglish.
- Phones that can reach the internet (mobile data or VPN) have Asks blocked until they can't. This reuses the existing internet probe.

---

## 4. Project structure and the fragment contract

The project is **one web page** composed from 8 independent **fragments**, each `{ html, css, js }`.

- The **shell** is a fixed page: CSS variables `--bg --fg --accent --card`, a base style, and one `<section id="tile-<id>">` wrapper per tile in the fixed **page order**: hero, countdown, schedule, register, gallery, feedback, theme (button only), fixit. The shell also adds the anchor `id="register"` on the register section.
- A fragment's HTML is the **inner HTML** of its section. CSS must be scoped under `#tile-<id>`. JS must run in an IIFE and only touch its own section (the theme tile may also touch `<body>` / `<html>`).
- No external files, libraries, fonts, images or network calls.
- **Hooks:** elements that checks need carry `data-hook="<name>"`. The hook names are given to the AI in the hidden system prompt, not to students. Students describe what they want; the AI is told the technical hook names.
- The **checklist is not sent to the AI**. Requirements come from the student's Ask. This keeps prompt quality meaningful.

### Composer
`compose(fragments)` builds `index.html` (shell + sections in page order + each tile's CSS and JS). Unfinished tiles render a "coming soon" placeholder. The same composer feeds the full-page preview, the site check and the published site.

---

## 5. The tiles

Event constants live in `data/events/tile-rush/tasks.json`:
- Event name: **IEDC Fest 2026**, tagline: **Build. Break. Launch.**
- Countdown target: **2026-12-15T09:00:00+05:30**

"Visible" items are the student-facing checklist. "Hooks" are given only to the AI. "Checks" run server-side in jsdom.

### 5.1 Warm-up (unscored, WARMUP only)
- Visible: "The page heading shows your team name."
- Hook: `warmup-title`. Check: text contains the team name.
- Purpose: practise Ask, Save Point, Go Back. Free and uncounted.

### 5.2 T1 Hero banner (par 6 min)
- Visible: heading says "IEDC Fest 2026"; tagline says "Build. Break. Launch."; background uses a colour gradient; a "Register now" button.
- Hooks: `hero-title`, `hero-tagline`, `hero-cta`.
- Checks: title text contains "IEDC Fest 2026" (case and whitespace insensitive); tagline contains "Build. Break. Launch."; fragment CSS matches `(linear|radial|conic)-gradient(`; `hero-cta` is an `<a>` or `<button>` whose text matches `/register/i`.
- Hint: "Tell the AI the heading, the tagline and the button text exactly."

### 5.3 T2 Countdown (par 10 min, medium)
- Visible: counts down to 15 Dec 2026, 9:00 AM; shows days, hours, minutes, seconds in separate labelled boxes; updates every second; shows a message when time is up.
- Hooks: `cd-days`, `cd-hours`, `cd-minutes`, `cd-seconds`, `cd-message`. The AI is told to use `new Date("2026-12-15T09:00:00+05:30")`.
- Checks (fake clock): at 2026-12-13T06:30:00+05:30 the hooks read 2, 2, 30, 0 (leading zeros allowed) and `cd-message` does not match `/happening/i`; after advancing 1000 ms, seconds read 59 and minutes 29; at 2026-12-15T09:00:01+05:30 all four read 0 and `cd-message` matches `/happening/i`; each box's parent text contains a label matching day, hour, min and sec.
- Hint: "Say what it counts down to, and ask for a message when the time is over."

### 5.4 T3 Schedule (par 7 min)
- Visible: 4 session cards; each shows time, title and speaker; the cards sit in a neat grid.
- Sessions: 09:30 Opening (IEDC Team); 10:30 Idea Pitch (Student Founders); 12:00 Build Workshop (Industry Mentor); 14:00 Demo Time (Participating Teams).
- Hooks: `session-card`, `session-time`, `session-title`, `session-speaker`.
- Checks: exactly 4 `session-card`; each has a time matching `\d{1,2}[:.]\d{2}`, a non-empty title and a non-empty speaker; the four titles above all appear; fragment CSS contains `grid` or `flex`.
- Hint: "Give the AI all four sessions with their times and speakers."

### 5.5 T4 Registration form (par 12 min, medium)
- Visible: name, email and department fields; department list has at least 5 departments; an empty or wrong email shows an error; a valid form shows "Thanks, <name>!".
- Hooks: `reg-form`, `reg-name`, `reg-email`, `reg-dept`, `reg-error`, `reg-success`.
- Checks: `reg-dept` is a `<select>` with at least 5 non-empty options; submitting empty makes `reg-error` visible and `reg-success` not visible; name "Asha" with email "asha" shows `reg-error`; name "Asha", email "asha@example.com" and the first department makes `reg-success` visible with text containing "Asha" and clears the error. "Visible" means non-empty text, not `hidden`, and computed `display` is not `none`.
- Hint: "Describe what should happen for an empty form, a wrong email, and a correct one."

### 5.6 T5 Dark/light switch (par 6 min)
- Visible: a button to switch dark mode; clicking switches the page to dark colours; clicking again switches back.
- Hook: `theme-toggle`.
- Checks: snapshot S0 of class, data attributes, inline style on `<html>` and `<body>`, and the computed `--bg`/`--fg`; click makes S1 differ from S0 (and, if the background colour is parseable, darker); second click returns exactly to S0.
- Hint: "Ask the AI to use the page's colour variables."

### 5.7 T6 Gallery (par 7 min)
- Visible: 6 cards in a grid with an emoji or colour block and a caption; cards grow or glow on hover.
- Captions: Hackathon, Workshop, Demo Day, Mentor Talk, Pitch Night, Networking.
- Hooks: `gallery-card`, `gallery-caption`.
- Checks: exactly 6 `gallery-card`, each with a non-empty caption, and the six captions appear; fragment CSS contains a `:hover` rule that sets `transform`, `box-shadow`, `scale`, `filter` or `background`.
- Hint: "Name the six captions and say what should happen on hover."

### 5.8 T7 Feedback stars (par 10 min, medium)
- Visible: 5 stars; tapping a star highlights that many; the text shows "You rated: N/5"; a thank-you message appears after rating.
- Hooks: `star` (5, in order), `rating-text`, `rating-thanks`. Selected stars carry `data-active="true"`.
- Checks: click star 3: exactly 3 stars active, `rating-text` contains "3", `rating-thanks` visible; click star 5: 5 active; click star 2: exactly 2 active and text contains "2".
- Hint: "Describe what happens when you tap star 3, then tap star 5."

### 5.9 T8 Fix-it (par 12 min, medium)
- A **pre-built section with 2 planted bugs** (the AI sees this current code).
- Visible: clicking Like adds 1 to the count; an empty email shows "Please enter an email"; a valid email shows "Subscribed!".
- Hooks present in the starter: `like-btn`, `like-count`, `news-form`, `news-email`, `news-error`, `news-success`.
- Bug A: the Like handler updates the wrong element id, so the count never changes. Bug B: the newsletter form accepts an empty email.
- Checks: click Like twice, count goes up by 2; submit empty shows `news-error` containing "Please enter an email"; valid email shows `news-success` containing "Subscribed!"; **regression:** heading, Like button and email field still exist.
- Hint: "Describe what you see going wrong, not the code."

### 5.10 Hints (all tiles)
Three per tile, shown one at a time. Hint 1 is the tile-specific line above. Hint 2: "Name each part you want (title, button, box)." Hint 3: "Ask for one change at a time and say the colours or sizes."

### 5.11 Deliverables per tile
For every tile, in `packages/shared/src/events/tile-rush/tiles/<id>/`: the starter fragment, a **reference fragment** (passes every check, used by Safe Mode and tests), and at least **3 bad fragments** (each fails a specific checklist item).

### 5.12 Simplified variants (pre-approved fallbacks)
If Gate 0.5 (section 16.6) shows a JS tile is not reliable enough, switch that tile to its simple variant. The student-facing checklist and the checks shrink to the core; nothing else changes. Switching is a config flag per tile in `tasks.json` (`variant: "full" | "simple"`).
- **T2 Countdown (simple):** shows days, hours and minutes only (no seconds box, no time-up message). Checks `cd-days`, `cd-hours`, `cd-minutes` at the fixed fake-clock instant.
- **T4 Registration (simple):** no email-format check and no minimum of 5 departments. Checks: fields exist, empty submit shows `reg-error`, a filled form shows `reg-success` containing the name.
- **T7 Stars (simple):** no thank-you message. Checks only the active-star count and `rating-text`.
- **T8 Fix-it (simple):** the starter has only Bug A (Like button). Bug B is removed.
- Matching rules: the checklist shown to students is generated from the active variant, so what they see always equals what is checked. Scoring, par times and hints are unchanged.

---

## 6. Asking the AI

### 6.1 Rules
- An Ask is a student's text plus the tile's current fragment. The answer replaces the fragment (after an automatic snapshot).
- **Cooldown:** per team, 40 s after an answer is delivered, plus 5 s per queued request, capped at 90 s. Shown as a countdown to every member ("Bulbu is thinking...").
- **Cap:** 60 delivered Asks per team. A warning appears at 50.
- **Only delivered answers count.** Timeouts, malformed answers and rejected answers are retried automatically on the next model (up to 2 times), are free and are not shown as Asks.
- Warm-up Asks are free and uncounted.

### 6.2 System prompt (hidden)
```text
You help beginners build one section of an event web page.
Section: {tile.title} (id: {tile.id}).
The user may write in English, Malayalam or Manglish. Reply in the same
language in at most 2 short sentences, then give the code.
Rules:
- Output exactly three blocks: <html>...</html>, <css>...</css>, <js>...</js>.
  Leave a block empty if not needed. No markdown fences, no other code.
- Write only the inner HTML of this section (no <html>, <head>, <body>,
  no <section> wrapper). Scope all CSS under #tile-{id}. JS must run inside
  an IIFE and only touch this section.
- No external files, libraries, fonts, images or network calls. Use emoji or CSS.
- Use these CSS variables from the page: --bg, --fg, --accent, --card.
- Add these data-hook attributes where they apply: {hooks with meanings}
- Keep the code simple and readable.
Project Notes from the team: {notes or "(none)"}
Current code of this section:
<html>{html}</html><css>{css}</css><js>{js}</js>
```
If a Gemma model does not accept a system instruction, send the same text as a prefix of the user message.

### 6.3 Parsing and validation
- Extract the three tagged blocks tolerantly (strip stray fences). Text outside the blocks becomes the short explanation (max 280 characters).
- Reject an answer when: no block is present; total size is over 20 KB; it contains `<script src`, `http://`, `https://` in `src`/`href` (anchors `#...` are fine), `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `import(`, `importScripts`, `sendBeacon`, `eval(`, `document.cookie`, `window.parent`, `window.top`, `localStorage`, `sessionStorage`.

---

## 7. Save Point, Go Back, Notes, Auto-solve, Glitch

- **Save Point:** a named snapshot of the tile's fragment (auto-label "Save Point N", optional note). Up to 10 per tile.
- **Auto-save:** a silent snapshot is taken before every delivered answer (last 5 kept per tile). Shown in the Go Back list as "Auto". They do not count for scoring.
- **Go Back:** restores any Save Point or auto-save to the tile (creates an auto-save first, so Go Back is also reversible).
- **Project Notes:** one shared text note per team (max 500 characters), included in every system prompt.
- **Hints:** up to 3 per tile, each costs points.
- **Auto-solve ("Show me"):** available after 12 minutes on a tile, max 2 per team. Installs the reference fragment, completes the tile at reduced credit.
- **Glitch (host toggle, default ON):** between minutes 50 and 70 of the build clock, one random delivered answer per team is replaced by a placeholder ("Bulbu spilled coffee on this section. Use Go Back.") that fails the checks. It is free, does not count as an Ask, and happens at most once per team. Host can fire or cancel it manually.

---

## 8. Puzzle

- 3x3 sliding puzzle. The picture is the **Bulbu doodle** (reuse the existing app's art, drawn with SVG/CSS) cut into 8 pieces with the empty slot at the bottom right when solved.
- Completing tile k reveals piece `perm[k]`, where `perm` is a per-team seeded permutation. The board shows revealed pieces forming the picture on the wall.
- **Generation (server, seeded by team seed):** start from the solved state, make 18-26 random legal moves with no immediate reversal; compute the optimal solution length by BFS (181,440 reachable states, instant); accept only if it is **8-14 moves** and the state is not solved, otherwise reseed. Store `optimal`.
- **Play:** tap a piece next to the empty slot. Every move is validated and timestamped by the server. Any member can move; the server serializes and rejects stale moves with the current state.
- **Start:** when the 8th tile completes. **End:** the arrangement is solved.
- **Partial credit at freeze:** 100 x (pieces in the correct place / 8), rounded down.

---

## 9. Publish, site check, gallery, change request

### 9.1 Publish
Allowed after the puzzle is solved. Steps: compose the page; run the **site check** (all 8 tile suites against the composed page, plus the page loads with no uncaught JavaScript errors); if it passes, publish.

- If it fails, the team sees which tile broke in friendly words and can fix it with an Ask.
- Published sites are served from a **second port (4001)** at `/s/<team-slug>/`, with a CSP header that blocks network access.
- **Download my site** gives the single `index.html`.
- Republishing is unlimited until freeze.

### 9.2 Site gallery
`/sites` on port 4001 lists all published sites with team names, so everyone can open each other's pages during the showcase.

### 9.3 Change request ("client call")
On a team's first successful publish, the server sends a client message (variant chosen by seed):
- A: "Please add the line 'Free food for all participants!' to the page."
- B: "Please add the line 'Bring your ID card to enter' to the page."
- C: "Please add the line 'Registration closes on 10 Dec' to the page."

The new element carries `data-hook="cr-banner"` (hook given to the AI when the request is active). Check: `cr-banner` text contains the phrase, and all 8 tile suites still pass. The team republishes. Scoring in section 10.

---

## 10. Scoring

All numbers live in `data/events/tile-rush/scoring.json`. Round to whole points.

### 10.1 Per tile (completed)
- Base: **100**
- Speed: `round(50 x clamp((2P - T) / P, 0, 1))`, where T is minutes from the tile first being opened to it passing and P is its par.
- Efficiency: A is the number of delivered Asks on that tile: A <= 3 gives **50**; A = 4 gives 30; A = 5 gives 15; A >= 6 gives 0.
- Save Point habit: **+10** if the team made at least one manual Save Point on that tile before it passed.
- Hints: **-10** each (max -30 per tile).
- **Auto-solved tile:** base 50 only, no bonuses.
- **Not completed at freeze:** `floor(50 x checks passed / total checks)`, no bonuses.

### 10.2 Team-level
| Part | Points |
|---|---|
| Project Notes (at least 15 words when the 4th tile completes) | +60 once |
| Clean Rewind (used Go Back, then that tile passed) | +20 once |
| Puzzle solved | 300 |
| Puzzle time bonus | `round(150 x clamp((2Q - t) / Q, 0, 1))`, where Q = 30 + 8 x optimal seconds and t is the solve time |
| Puzzle moves bonus | `round(100 x clamp(optimal / moves, 0, 1))` |
| Publish (first successful) | 200 |
| Publish rank bonus | 1st +100, 2nd +80, 3rd +60, 4th-6th +40, later +20 (rank by size-adjusted publish time, see 10.6) |
| Change request done within 10 min of the message | +100 |
| Change request done within 20 min | +50 |

Maximum is about 2,710. Penalties never take a tile below 0.

### 10.3 Tie-breaks
Higher score, then earlier size-adjusted publish time (10.6), then fewer total Asks, then earlier puzzle solve time.

### 10.4 Badges (shown on wall and summary, no extra points)
First Blood (first tile of the event), Quick Draw (a tile with 1 Ask), Save Hero (Save Point on at least 6 tiles), Clean Rewind, Notes Ninja, Puzzle Pro (solved within optimal + 2 moves), Zero Hints, First to Publish, Client Pleaser (change request within 10 min).

### 10.5 Awards
Champion (top score), Fastest Publish (size-adjusted), Fastest Small Team (special mention for the fastest 2-member team by raw publish time), Cleanest Asks (fewest total Asks among teams that published), Best-Looking Site (audience vote), Comeback (largest rank gain between the standings at 60 minutes and the final).

### 10.6 Team-size adjustment
Two-person teams have half the hands of a four-person team, so publish timing is compared on an adjusted time:
`t_adj = t_elapsed x sizeFactor(n)`, where `t_elapsed` is the event time at publish and `n` is the number of members.
- `sizeFactor` lives in `scoring.json`: `{ "2": 0.85, "3": 1.0, "4": 1.15 }`. A 2-member team's time counts as 15% shorter, a 4-member team's as 15% longer.
- `t_adj` is used for: the publish rank bonus, the Fastest Publish award and the publish tie-break. Raw times are always shown on the wall and logged next to the adjusted time.
- Tile par times and per-tile scoring are not adjusted (individual tiles are done by one person at a time).
- Calibration: the factors are a starting guess. After the dress rehearsal, adjust them so that equally skilled teams of different sizes land within 15% of each other, using the logged team size and cooldown-wait time.

---

## 11. Host console, projector wall, voting

### 11.1 Host console
- **Setup:** clock length, glitch on/off, team size limits, event constants.
- **Registration:** live team and member list, rename/move/remove members, lock registration.
- **Control:** start warm-up, start build, pause/resume, extend time, freeze, open showcase, close.
- **Teams:** per-team detail (stage, tiles, Asks, hints, notes, time on tile), unlock a tile (complete without bonuses), reset a team, send a message to a team, fire glitch, spotlight on the wall.
- **Model health panel:** per model requests used, recent errors, status, manual disable, and a **Safe Mode** switch.
- **Network doctor:** QR for the join address, phones connected, internet probe results.
- **Showcase:** select a team to show its published site full screen; open voting.
- **Export results.**

### 11.2 Projector wall
- Header: event name, big **clock**, state, join QR (during registration).
- Main: a grid of up to 15 **team cards**, each with a mini 3x3 board where the picture builds up piece by piece, team name, stage chip (Tiles x/8, Puzzle, Published, Change request) and score. Status uses icons as well as colour.
- Right column: **leaderboard** (top 10 with rank changes) and a **live feed** of the last 8 events (tile done, badge, publish, glitch).
- Bottom bar: model health, network status, Asks per minute.
- **Spotlight:** every 20 seconds a team is highlighted with an animation, or the host can pin one.
- **Finale:** podium with the awards. In showcase, full-screen team site.

### 11.3 Voting (Best-Looking Site)
During SHOWCASE each Student ID gets one vote for a team other than its own. Votes are stored and shown on the wall by the host.

---

## 12. AI gateway (Gemini API only)

### 12.1 Models and limits (from the organizer's own AI Studio, columns RPM / TPM / RPD)
| Model | RPM | TPM | RPD | Role |
|---|---|---|---|---|
| Gemma 4 26B | 30 | 16K | 14.4K | Primary |
| Gemma 4 31B | 30 | 16K | 14.4K | Primary |
| Gemini 3.1 Flash-Lite | 15 | 250K | 500 | Overflow |
| Gemini 3.5 Flash-Lite | 15 | 250K | 500 | Overflow |

Do not use the regular Flash models (5 RPM, 20 RPD) or Pro models (0). Per Google's rate-limit doc, TPM counts input tokens. Limits are per project, so extra keys add nothing. The table lives in `data/events/tile-rush/models.json`.

### 12.2 Behaviour
- **One API key** in an env var, used only on the arena server.
- **Queue:** fair across teams (round-robin), max 6 requests in flight, 45 s timeout per request.
- **Model chain:** spread across the two Gemma models, then the two Flash-Lite models. Skip a model at its RPM, estimated input TPM (characters / 4) or daily limit, or on 429/5xx/timeout. Pause a model for about 60 s after repeated errors.
- Keep requests small: tile-sized fragments, compact system prompt, `max_output_tokens` about 1,200.
- **Mock provider** (latency 2-25 s, 3% failures, 1% malformed answers) for development, tests and load tests. No quota spent.
- **Safe Mode:** if no Gemini model works, return the tile's reference fragment with a visible "Bulbu's backup answer" note, so the event continues. Host can also switch it on manually.
- **Privacy:** Google says free-tier content is used to improve its products for most models. Show a notice at join: no personal information in Asks.
- **Quota timing:** daily quotas reset at midnight Pacific = **12:30 pm IST**. Rehearsals use the mock provider or Gemma, not the Flash-Lite daily quota.

### 12.3 Expected load (estimate)
15 teams x 8 tiles x 3-4 Asks = about 360-480 Asks over about 80 minutes (5-6 per minute on average, 10-15 at peak). At about 1-1.5K input tokens each, the two Gemma models alone should cover the rate.

---

## 13. Architecture, data and persistence

### 13.1 Why a new layer
Existing games are short synchronized rounds with one answer. This event is long, team-based and multi-step. Add a parallel **event module** that reuses the existing plumbing and leaves current games untouched.

| Existing piece | Plan |
|---|---|
| Student ID + PIN, Socket.IO, device tokens, reconnects | Reuse (new `/events` namespace) |
| Snapshots + event log, crash recovery | Reuse for team state |
| Host and projector shells, doodle design, sounds | Reuse shell, new views |
| Network doctor, internet probe | Extend with a router mode flag |
| `data/` content convention | Extend with `data/events/tile-rush/` |
| `pnpm bots` | Extend with team and mock-AI simulation |
| Teams, gateway, workspace, composer, check runner, puzzle, publish, voting | **New** |

### 13.2 Code layout
```
packages/shared/src/events/
  types.ts                  EventDefinition contract + registry
  tile-rush/
    tiles/<id>/             starter, reference, bad fragments, checks
    composer.ts  puzzle.ts  scoring.ts  parser.ts  workspace.ts
apps/arena/src/events/
  EventRoom.ts              state machine, own namespace and snapshots
  ai-gateway/               models.json loader, queue, limits, mock, safe mode
  checks-runner/            worker thread + jsdom
  sites/                    second-port static server
apps/web/src/events/tile-rush/   play/  host/  screen/  vote/
data/events/tile-rush/      event.json tasks.json scoring.json models.json vocabulary.json
```
`EventDefinition` exposes `createTeamState(seed, team)`, `applyAction(state, action, ctx)`, `score(state)` and `boardView(state)`. A future event adds one folder per layer plus a registry entry.

### 13.3 Messages (to be defined with zod schemas)
- Client to server: `team:create`, `team:join`, `team:leave`, `member:ready`, `tile:open`, `tile:close`, `ask:send`, `check:run`, `save:create`, `save:restore`, `notes:update`, `hint:use`, `autosolve:use`, `puzzle:move`, `publish:go`, `vote:cast`.
- Server to client: team state, event state, ask result, check result, toast, wall update, host updates.
- The server is authoritative for the clock, cooldowns, checks, scores, puzzle moves and publishing.

### 13.4 Persistence
Team state is saved on every change (debounced about 1 s) with an event log. A server restart restores everything, including the clock, cooldowns and published sites. Exports go to `data/runs/<event-id>/`.

### 13.5 Results export
JSON and CSV with: team name, members (name, ID, department, semester), team size, final score and breakdown, raw and size-adjusted publish time, total cooldown-wait time, tile times, Asks, hints, Save Points, notes, puzzle time and moves, publish time, change request time, badges. Optional prompt log (contains student text). Files contain student IDs, so keep them local.

---

## 14. Security and fairness

- **Student code never runs on the arena's origin.** Preview iframes use `srcdoc` with `sandbox="allow-scripts"` (no `allow-same-origin`) and a restrictive CSP meta tag. Published sites are on port 4001 with a CSP header.
- **Check runner:** worker thread, jsdom with `runScripts` enabled but network APIs removed (`XMLHttpRequest`, `WebSocket`, `EventSource` stubbed out), hard timeout (3 s), memory limit, killed on overrun, no filesystem access. The 20 KB size limit and forbidden-pattern list in section 6.3 are a second layer.
- Gemini key never reaches a client. Rate limits and size limits on every message.
- Everyone gets the same AI, same tile set, same cooldown and same cap. The internet probe blocks Asks from phones with their own internet.
- Teams can still share ideas verbally; the tile order is shuffled per team to limit copying.

---

## 15. Network and event-day setup

- Laptop on the router by ethernet and on Wi-Fi for internet.
- The router's DHCP hands out a gateway without internet. Give the ethernet adapter a **static IP with no gateway** so internet goes via Wi-Fi. Print the join QR for that fixed address.
- Internet Connection Sharing **off**, network profile Private, firewall open for ports **4000** (arena and web) and **4001** (published sites). Sleep and hibernate off, laptop plugged in, high-performance power plan, good airflow.
- An `ALLOW_HOST_INTERNET` flag stops the Network doctor warning about the laptop's internet. Keep the phone-side probe.
- For up to 60 phones, confirm the router's real concurrent client limit, and add a second access point if needed.
- Add an Event Day section to `docs/EVENT_DAY.md` with this checklist and the host runbook.

---

## 16. Test plan

Every gate in section 17 ends with its tests passing. `pnpm test` must stay green for the existing games.

### 16.1 Unit tests (Vitest)
- **Puzzle:** seeded and deterministic; always solvable; optimal length 8-14; no immediate reversals; move validation (adjacent only, stale moves rejected); partial credit.
- **Composer:** 8 fragments compose in page order; scoped CSS has no collisions; placeholders for unfinished tiles.
- **Workspace:** Save Point create/restore, auto-save retention (5), Go Back is reversible, limits (10 Save Points per tile).
- **Scoring:** table-driven cases at every boundary (sizeFactor 2/3/4 and rank order after adjustment, par boundary, 2P cutoff, Ask thresholds 3/4/5/6, hints cap, auto-solve, partial credit, Project Notes word count, rank-based publish bonus, tie-breaks, change request windows).
- **Parser and validator:** valid answers, missing blocks, fences, oversize, and each forbidden pattern.
- **Gateway:** per-model RPM/TPM/daily limits with fake timers, failover order, 60 s pause after repeated errors, adaptive cooldown, free retry on malformed answers, round-robin fairness, queue cap, timeout, mock provider, Safe Mode.

### 16.2 Check runner tests
- For each of the 8 tiles plus warm-up: the **reference fragment passes every check** and **each bad fragment fails exactly its intended checklist item**.
- Composite of the 8 reference fragments passes the **site check**; order of completion does not matter; the theme toggle does not break other sections.
- Hostile fragments (infinite loop, memory bomb, network attempts, huge DOM) are killed within the timeout without affecting the arena.
- Change request checks for all three variants.

### 16.3 Integration tests (arena with `socket.io-client`)
- Registration: team code join, 2-4 member rules, unique team name and Student ID, captain actions, late join during warm-up only.
- Reconnect and second-device resume with PIN.
- Parallel members on different tiles; tile soft lock and idle release.
- Cooldown enforcement, Ask cap, free retries not counted.
- Clock: start, pause (blocks Asks and moves), resume, extend, freeze (partial credit computed, sites stay online).
- Glitch fires once per team in its window and is free; Go Back recovers.
- Safe Mode switch (automatic and manual).
- **Crash recovery:** kill and restart the arena mid-event; every team, clock, cooldown and published site is restored.
- Export contents match the state.

### 16.4 End-to-end (Playwright, mobile viewports)
Three teams (sizes 2, 3, 4) with the mock AI: register, warm-up, all 8 tiles, puzzle, publish, change request, freeze, showcase, voting and export. Assertions on the projector wall (pieces reveal, leaderboard order, feed), the host controls (pause, extend, unlock, reset, kick) and the site gallery.

### 16.5 Load and soak (bots)
- 15 simulated teams (60 clients) with realistic think times and the mock provider's latency and failure mix.
- Size-fairness simulation: bots of equal skill in teams of 2, 3 and 4; their adjusted publish times must differ by less than 15%.
- Budgets: arena CPU average under 40% and RAM under 500 MB on the event laptop; wall update latency p95 under 1 s; check run p95 under 1.5 s; no team starved in the queue; gateway never exceeds per-model limits (verified from logs).
- **Soak:** a 2-hour run (or a time-compressed equivalent) with random disconnects and reconnects, and one forced arena restart.

### 16.6 Real-API quality test (Gate 0.5, runs BEFORE the platform is built)
The standalone kit `tile-rush-quality-kit/` implements this. It contains the 8 tiles (hooks, visible checklists, jsdom checks, reference, starter and bad fragments), the sandboxed check runner, the parser/validator, the 24-prompt corpus and a Gemini client. Its own self-test (83 checks) must pass first.
- Corpus: 24 beginner prompts (3 per tile: vague, medium, detailed, including Malayalam and Manglish). A failed Ask is followed by up to 2 automatic follow-ups built from the failing checklist items, like a student would.
- Run against each model of the primary chain (Gemma 4 26B and 31B) and, as overflow, Flash-Lite 3.1 and 3.5, using exact ids from `npm run list-models`.
- **Gate:** for each primary-chain model, pass@3 is at least **70% overall** and **at least 2 of 3 prompts pass on every tile**.
- **If it fails:** (1) re-run the failing tiles with `--variant simple` (section 5.12) and adopt the simple variant for those tiles; (2) if still failing, tune the system prompt and hook wording (maximum 2 rounds); (3) if still failing, change the model order or reduce the pool and report to the organizer before building further.
- Records: pass@1/pass@3 per model, tile and level; latency p50/p95; whether the model accepts system instructions (otherwise the instructions go in the user message).
- The same corpus is re-run in Gate 7 through the real gateway as a regression check.

### 16.7 Usability test
Three beginners from non-CS departments complete the warm-up and tiles 1-3 unaided. Pass criteria: first tile passed within 12 minutes; no confusion about the vocabulary; copy fixed wherever they hesitated.

### 16.8 Hardware and network rehearsal
- Real router and event laptop with **at least 20 real phones**: join success, Wi-Fi capacity, latency.
- Phone with mobile data on: Asks are blocked and the host is told.
- Pull the laptop's internet mid-event: Safe Mode engages and recovers when internet returns.
- Laptop thermals over 90 minutes; sleep disabled; power plan.
- Projector readability from the back of the room; colour is never the only status signal.

### 16.9 Full dress rehearsal
One full-length run with at least 5 real teams (about 15 people), using the real Gemini API and the final scoring. Fix everything found, then re-run the affected tests.

### 16.10 Acceptance criteria
- All automated suites green; no flaky tests across 3 consecutive runs.
- Quality gate (16.6) met, and the size-fairness criterion in 16.5 met (calibrated in the dress rehearsal).
- Dress rehearsal: every rehearsal team reaches **Publish**.
- No data loss after a forced restart.
- Performance budgets (16.5) met on the event laptop.

---

## 17. Build order, gates and effort

Effort is my rough estimate for one developer working with Claude Code. Do not start a gate until the previous gate's tests pass.

| Gate | Work | Exit criteria | Estimate |
|---|---|---|---|
| 0 | Recon and scaffold: confirm integration points, event contract, registry, `/events` namespace, empty event in host console and wall | Empty event visible; existing tests green | 0.5 day |
| 0.5 | **Quality spike:** run the quality kit against the real Gemini models (section 16.6); adopt simple variants if needed | Gate in 16.6 met; decisions recorded | 0.5 day |
| 1 | AI gateway, parser/validator, mock provider, Safe Mode, Gemini probe script | Gateway unit tests pass; probe results recorded | 1 day |
| 2 | Workspace, composer, preview, check runner, 8 tiles with reference and bad fragments, Ask flow, Save Point, Go Back, Notes, hints | Check runner tests pass; a phone completes a tile with the mock AI | 2.5 days |
| 3 | Teams, registration, lobby, host core, persistence and restart recovery | Integration tests for registration, reconnect, restart pass | 1 day |
| 4 | Puzzle, publish, site check, second-port sites, gallery, download, change request, glitch, auto-solve | Puzzle, composer and publish tests pass; one team runs start to finish | 1.5 days |
| 5 | Projector wall, host showcase, voting, scoring, badges, awards, export | Wall and scoring tests pass; E2E for 3 teams passes | 1.5 days |
| 6 | Full automated suites, load, soak; fixes | Section 16.1-16.5 acceptance met | 2 days |
| 7 | Real-API quality gate and prompt tuning; usability test | Quality gate re-run through the gateway and usability criteria met | 1 day |
| 8 | Hardware and network rehearsal, dress rehearsal, runbook, fixes | Section 16.8-16.10 acceptance met | 1 day |

**Total: about 11.5 working days** (my estimate, with a range of roughly 8-12). The event date should be set only after Gate 6 is green, with at least 2-3 days of buffer for Gates 7-8.

---

## 18. Definition of done

- Every feature in sections 3-12 works as specified.
- All tests in section 16 pass and the acceptance criteria in 16.10 are met.
- `docs/EVENT_DAY.md` has the Tile Rush host runbook and checklist.
- Another organizer could set up and run the event from the docs alone.
- Adding a future event needs only a new folder per layer and a registry entry.

---

## 19. Prompts for Claude Code

Put this file in the repo as `docs/tile-rush-spec.md`.

**Working agreement (use at the start of every gate):**
```text
Read docs/tile-rush-spec.md fully. We are implementing Gate N only. Do not
change existing game code. Write the tests listed for this gate first or
alongside the code, run them, and keep `pnpm test` green. Do not start the
next gate. When done, list what passed, what you could not test, and any
place where the spec was ambiguous.
```

**Gate 0:**
```text
Find where socket identity, snapshot persistence, host auth and the web
static routes are wired, and report them. Then scaffold the EventDefinition
contract and registry in packages/shared/src/events, an EventRoom on a
separate Socket.IO namespace in apps/arena, and an empty "tile-rush" event
that appears in the host console and projector screen.
```

**Gate 1:**
```text
Build apps/arena/src/events/ai-gateway for the Google Gemini API only,
exactly as in section 12, plus the parser/validator from section 6.3, the
mock provider and Safe Mode. Read model limits from
data/events/tile-rush/models.json. Add a script that probes each model with
one realistic tile request and reports latency, errors and whether system
instructions work.
```

---

## Sources
- Repo README: https://github.com/ajayda24/iedc-hub-tournaments
- Gemini API rate limits (TPM counts input tokens; limits shown in AI Studio): https://ai.google.dev/gemini-api/docs/rate-limits
- Google AI Studio pricing (free models and data use): https://aistudio.google.com/docs/pricing
- Model limits table: the organizer's own AI Studio Rate Limit page
