# Event Day Guide

Everything runs from **one laptop**. Nobody needs internet, and students install nothing. They scan a QR code and play in the browser.

**The kit folder:**

| File | When |
|---|---|
| `1-FIRST-TIME-SETUP.bat` | once per laptop (asks for admin) |
| `2-START-EVENT.bat` | every event day; keep its window open |
| `START-FRESH-EVENT.bat` | to start a brand-new event (PINs and history are kept) |
| `BACKUP-DATA.bat` | after every event |
| `arena-data/` | **this laptop's data**: PINs, tournament history, results. Never delete it. |
| `app/` | the program itself; you don't need to open it |

```
 Laptop (Windows Mobile Hotspot, up to 128 phones)
 └─ runs the arena  →  http://192.168.137.1:4000
     ├─ /play     students (phones)
     ├─ /host     you (PIN protected)
     └─ /screen   projector / TV
```

---

## Once, a few days before

1. **Install Node.js 20 LTS or newer** on the laptop from https://nodejs.org.
2. **Copy the event kit folder** onto the laptop: `dist/event-kit-<college>/` from `pnpm kit`, or unzip `event-kit-<college>.zip`.
3. **Double-click `1-FIRST-TIME-SETUP.bat`.** It asks for admin. It:
   - raises the Mobile Hotspot limit from 8 to **128** phones (`WifiMaxPeers`),
   - stops the hotspot from switching itself off,
   - opens port 4000 in the firewall,
   - helps you add the **Microsoft KM-TEST Loopback Adapter**. Windows will only start a hotspot when it has a connection to share, and sharing the loopback adapter means the hotspot works with **zero internet**. That's what we want.
4. Open **Settings → Network & internet → Mobile hotspot**. Set:
   - *Share my connection from* → the loopback adapter (shows as "Ethernet 2" or similar),
   - a short Wi-Fi name and password, for example `IEDC-ARENA` / `bigbrain24`,
   - **Power saving: Off**, if your Windows shows that option.
5. **Set your college name and departments** in the host console → **College** tab (skip this if your kit was built for your college with `pnpm new-college`).
6. **Print the QR code.** The laptop hotspot address is always `192.168.137.1`, so `http://192.168.137.1:4000/play/` never changes. Open the host console → *Network doctor* to get the QR, or just print the big-screen page.
7. **Do a dry run** with 3 or 4 friends, and run the bot test from the dev machine (`pnpm bots --n 60`). Check that phones stay connected for a whole round.

## On the day: 15 minutes before

1. Plug the laptop into power. Turn on **Airplane mode, then switch Wi-Fi back on**, so the laptop has no internet either.
2. Double-click **`2-START-EVENT.bat`**. It turns on the hotspot, prints the Wi-Fi name and password, and starts the server. Keep this window open. It shows:
   - **Host PIN**: type it on `/host`
   - **Students** URL
   - the **Data folder** where everything is saved
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
| End of the day | Double-click **`BACKUP-DATA.bat`** and copy `backups/` to a pen drive or Google Drive | — |
| Website | **Monthly** tab → **Download for website** → in the project folder `pnpm leaderboard <file>`, commit, push ([details](LEADERBOARD.md)) | The website's `/leaderboard` updates after Vercel rebuilds |

- **Knockout mode** (Event settings): the bottom X% are eliminated after each round and keep watching as spectators.
- **Anagram custom words**: pick "Custom words" in the round to use your own (event themes, sponsor names, inside jokes).
- **Crash?** Just run `2-START-EVENT.bat` again. Scores, players and the playlist are restored. A round that was live is closed and unfinished players get partial credit. Start a clean event with `START-FRESH-EVENT.bat`. `--fresh` never deletes students' PINs (`students.json`) or the monthly history (`history.json`).
- **Forgot PIN?** Host console → **Students** tab → search the Student ID → **reset PIN**. The student then creates a new one on their next join. **Unlock** clears the 10-minute lock after 5 wrong tries.
- **New version of the kit?** Copy your old kit's `arena-data` folder into the new kit folder (next to the .bat files) before starting. Everything carries over: PINs, history, results.
- **Moving laptops?** Copy the whole kit folder, including `arena-data`, to the new laptop. (Or: Monthly tab → **Backup history** on the old one and **Import backup** on the new one, plus `arena-data/students.json` for PINs.) Backups contain Student IDs, so keep them private and never commit them.

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
| `2-START-EVENT.bat` couldn't start the hotspot | Turn it on in Settings → Mobile hotspot. Check *Share from* = loopback adapter. |
| Phones join Wi-Fi but the page doesn't load | Firewall: run `1-FIRST-TIME-SETUP.bat` again (it adds the port 4000 rule). |
| Red "laptop has internet" warning | The laptop has Ethernet or another Wi-Fi with internet. Disconnect it. |
| A student changed phones | They join with the same Student ID and PIN and keep their score. Forgot the PIN? Students tab → reset PIN. |
| Students' PINs or old tournaments are gone | The kit is reading a different `arena-data` folder. The start window prints the **Data folder**; copy your old `arena-data` there. |
| Everything is slow | Close other apps on the laptop. Keep it plugged in. Move the laptop to the middle of the room. |
