# Brain Arena — Event Day Guide

Everything runs from **one laptop**. Nobody needs internet, and students install nothing. They scan a QR code and play in the browser.

```
 Laptop (Windows Mobile Hotspot, up to 128 phones)
 └─ runs Brain Arena  →  http://192.168.137.1:4000
     ├─ /play     students (phones)
     ├─ /host     you (PIN protected)
     └─ /screen   projector / TV
```

---

## Once, a few days before

1. **Install Node.js 20 LTS or newer** on the laptop from https://nodejs.org.
2. **Copy the `brain-arena` folder** (from `pnpm pack:arena`) onto the laptop.
3. **Right-click `setup-hotspot.ps1` → Run with PowerShell.** It asks for admin. The script:
   - raises the Mobile Hotspot limit from 8 to **128** phones (`WifiMaxPeers`),
   - stops the hotspot from switching itself off,
   - opens ports 4000 and 4001 in the firewall (4001: Tile Rush sites),
   - helps you add the **Microsoft KM-TEST Loopback Adapter**. Windows will only start a hotspot when it has a connection to share, and sharing the loopback adapter means the hotspot works with **zero internet**. That's what we want.
4. Open **Settings → Network & internet → Mobile hotspot**. Set:
   - *Share my connection from* → the loopback adapter (shows as "Ethernet 2" or similar),
   - a short Wi-Fi name and password, for example `IEDC-ARENA` / `bigbrain24`,
   - **Power saving: Off**, if your Windows shows that option.
5. **Print the QR code.** The laptop hotspot address is always `192.168.137.1`, so `http://192.168.137.1:4000/play/` never changes. Open the host console → *Network doctor* to get the QR, or just print the big-screen page.
6. **Do a dry run** with 3 or 4 friends, and run the bot test from the dev machine (`pnpm bots --n 60`). Check that phones stay connected for a whole round.

## On the day: 15 minutes before

1. Plug the laptop into power. Turn on **Airplane mode, then switch Wi-Fi back on**, so the laptop has no internet either.
2. Double-click **`start-arena.bat`**. It turns on the hotspot, prints the Wi-Fi name and password, and starts the server. Keep this window open. It shows:
   - **Host PIN**: type it on `/host`
   - **Students** URL
   - a big warning if the laptop can reach the internet
3. Open `http://localhost:4000/host/` on the laptop and enter the PIN.
4. Open `http://localhost:4000/screen/` on the projector (press F11 for fullscreen). Click "sound on" once so the browser allows audio.
5. Put the Wi-Fi name, password and QR on a slide or on the board.

## Running the event

| Step | You do | Students see |
|---|---|---|
| Lobby | Edit the **Playlist** (game, difficulty, time). Save. | Join form (name, Student ID, sem, dept) → create or enter their PIN → lobby with the "next up" rules |
| Start | **▶ Start R1** | 3-2-1 countdown on every phone at the same moment |
| Live | Watch solved count and **Flags**. Pause if the projector dies. | The puzzle, a timer and their live rank |
| Results | Read out first blood; the screen rotates the answer, top round results, overall board and dept wars | Their points, the answer and the full leaderboard |
| Finale | **Show podium** (this also records the tournament for the monthly leaderboard) | Podium, final rank and a funny title |
| After | **Export CSV** (also saved in `arena-data/` on the laptop) | — |
| End of the day | **Monthly** tab → **Download for website** → replace `config/leaderboard/monthly.json` in the repo, commit, push | The website's `/leaderboard` updates after Vercel rebuilds |

- **Knockout mode** (Event settings): the bottom X% are eliminated after each round and keep watching as spectators.
- **Anagram custom words**: pick "Custom words" in the round to use your own (event themes, sponsor names, inside jokes).
- **Crash?** Just run `start-arena.bat` again. Scores, players and the playlist are restored. A round that was live is closed and unfinished players get partial credit. Start a clean event with `start-arena.bat --fresh`. `--fresh` never deletes students' PINs (`students.json`) or the monthly history (`history.json`).
- **Forgot PIN?** Host console → **Students** tab → search the Student ID → **reset PIN**. The student then creates a new one on their next join. **Unlock** clears the 10-minute lock after 5 wrong tries.
- **Moving laptops?** On the old one: Monthly tab → **Backup history**. On the new one: **Import backup**. Copy `arena-data/students.json` across too to keep PINs. The backup contains Student IDs, so don't commit it.

## Anti-cheat

- **Internet = frozen.** Every phone keeps checking whether it can reach the internet (mobile data, VPN). If it can, the game freezes with a "Caught you online" screen until the student goes offline. It costs one strike per round and the host sees it under *Flags*.
- **Leaving the game** (switching apps or tabs) for more than 1.5 s during a round is a strike.
  - 1st strike: warning.
  - 2nd strike: −200 points.
  - 3rd strike: locked out of the round.
  You can change these thresholds in *Event settings*.
- **Unblock** clears a player's strikes, internet flag, lock or kick.
- Answers are checked on the laptop and never sent to phones before the round ends, so inspecting the page doesn't help.
- **What software can't stop:** a second phone or a friend whispering. Walk around, and seat teams apart.

## More than ~50 phones? (overflow)

The laptop's Wi-Fi card is the limit, not the 128 setting. If phones start dropping, use one of these:

1. **Repeater phones (no extra cost).** Many Androids (Samsung, Xiaomi, Realme, Vivo) have *Wi-Fi sharing* / *Wi-Fi repeater* under hotspot settings. That phone joins the laptop hotspot and re-shares it with ~10 more students. They use the **same URL and QR**. In the *Network doctor*, players behind a repeater show up grouped under one IP.
2. **USB Wi-Fi dongle (₹300 each)** joined to a separate phone hotspot. That phone hotspot **must have mobile data off**. The laptop then has a second address, and the host console and big screen show **one QR per network**.
3. **Travel router (~₹1.5k).** Supports 30+ clients and can be USB-powered.

## Troubleshooting

| Problem | Fix |
|---|---|
| Phone says "Can't reach the arena" | It's not on the event Wi-Fi, or it switched back to mobile data. Forget other networks. |
| `start-arena.bat` couldn't start the hotspot | Turn it on in Settings → Mobile hotspot. Check *Share from* = loopback adapter. |
| Phones join Wi-Fi but the page doesn't load | Firewall: run `setup-hotspot.ps1` again (it adds the port 4000 rule). |
| Red "laptop has internet" warning | The laptop has Ethernet or another Wi-Fi with internet. Disconnect it. |
| A student changed phones | They can join again with the same name and an initial added. Adjust points with ±100 if needed. |
| Everything is slow | Close other apps on the laptop. Keep it plugged in. Move the laptop to the middle of the room. |

---

# Tile Rush (team competition): event day

Teams of 2–4 build the **IEDC Fest Page** on their phones by asking an AI (Google Gemini), tile by tile, then solve a sliding puzzle and publish their site. It runs from the same kit, next to the weekly games:

```
 Laptop  (on the router by Ethernet; on Wi-Fi for internet, which Gemini needs)
 ├─ http://<laptop>:4000/competitions/vibecoding/          students (phones)
 ├─ http://localhost:4000/competitions/vibecoding/host/    you (same host PIN)
 ├─ http://localhost:4000/competitions/vibecoding/screen/  projector wall
 └─ http://<laptop>:4001/sites/                            published sites (gallery)
```

The full rules, scoring and design are in `docs/competitions/vibecoding-spec.md` in the repo.

## Network: a router, not the hotspot

Students must have **no internet**, but the laptop needs it for Gemini. So:

1. **A Wi-Fi router with no internet** for the students. Its DHCP hands out addresses as usual.
2. **The laptop on that router by Ethernet**, with a **static IP and no gateway** on the Ethernet adapter (e.g. `192.168.0.10`, mask `255.255.255.0`, gateway empty). Then internet traffic goes out over the laptop's Wi-Fi, never the router.
3. **The laptop on another Wi-Fi with internet** (phone hotspot or campus Wi-Fi).
4. **Internet Connection Sharing off**, network profile **Private**, firewall open for **4000 and 4001** (`setup-hotspot.ps1` opens both; skip its hotspot parts if you use a router).
5. Sleep and hibernate **off**, the laptop **plugged in**, power plan **High performance**, good airflow.
6. **Print the join QR** for `http://<static IP>:4000/competitions/vibecoding/` (the host console's Network tab shows it).
7. Check the router's **real client limit**. For ~60 phones you may need a second access point.

On the day, start it with **`start-tilerush.bat`** (not `start-arena.bat`): it doesn't turn on the hotspot and doesn't warn that the laptop is online.

The host console warns when the laptop has **no** internet (Gemini can't be reached). Students' phones are still checked: a phone that can reach the internet has its Asks blocked until it can't.

## A few days before

1. Paste the **Gemini API key** in host console → **AI** → *Save key* (it stays in `arena-data/competitions/vibecoding/gemini-key.txt` on this laptop, never on GitHub). Without a key, Asks use a pretend AI.
2. Run a rehearsal (see `docs/competitions/vibecoding-rehearsal.md` in the repo).
3. Quotas: the free Gemini daily quota resets at **12:30 pm IST**. Rehearse with Safe Mode or the mock AI the day before, not with the Flash-Lite quota.

## Run of show (build 10:30–12:30)

| Time | You do (host console) | Students / wall |
|---|---|---|
| by 10:00 | **Control → Open registration** | Join with Student ID + PIN, create or join a team (4-letter code) |
| 10:30 | Kickoff, rules | Wall shows teams forming and the join QR |
| 10:40 | **Start warm-up** | The free practice tile: Ask, Save Point, Go Back |
| 10:50 | **Start the build clock** (100 min) | 8 tiles, then the puzzle, Publish, the client's change request |
| any time | **Pause / Resume / +5 / +10 min**; Teams tab: message, unlock a tile, reset, glitch; People tab: move or remove students | Wall: picture building up, leaderboard, live feed, spotlight |
| 12:30 | Clock ends, or **Freeze now** | No more Asks or publishes; sites stay online; results are exported |
| 1:30 (optional) | **Open showcase** → Showcase tab: show a site on the big screen, **Open voting** | Phones: summary, badges, the "you were coding" reveal, voting |
| end | **Close the event** | Results exported again (with the votes) |

**Results:** `arena-data/competitions/vibecoding/runs/<run>/results.csv` (and `.json`). They contain Student IDs: keep them on the laptop. **Export results** in the Control tab writes them any time.

**A new event:** Control → **Start a new run**. The old run moves to `arena-data/competitions/vibecoding/archive/` (never deleted).

## If something goes wrong

| Problem | Fix |
|---|---|
| AI tab: models "paused" or "limit", Asks failing | The gateway already falls back down the chain. If nothing answers, **Safe Mode** switches on by itself: students get Bulbu's backup answer and the event goes on. You can also turn Safe Mode on yourself. |
| "No key yet" in the AI tab | Paste the key from AI Studio and Save. |
| A team is stuck on a tile | Teams tab → the team → **Unlock** (it counts as done, without bonuses), or tell them about **Show me** (after 12 minutes on a tile). |
| A student is in the wrong team | People tab → **Move to…** |
| The laptop crashed | Start it again: everything comes back (teams, tiles, clock, published sites). Phones reconnect by themselves. |
| Sites don't open on phones | Port 4001 is blocked: run `setup-hotspot.ps1` again (it opens 4000 and 4001). |
