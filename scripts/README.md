# `scripts/`: build helpers

| Path | What it does |
|---|---|
| `pack-arena.mjs` | `pnpm pack:arena`: builds the event kit in `dist/brain-arena/`. It only replaces the app files and **never touches `arena-data/`**. `--out <folder>` builds somewhere else. |
| `precompress.mjs` | Writes `.gz`/`.br` copies of the web build so phones load it faster over the hotspot (runs inside `pnpm build`). |
| `event-kit/` | The files copied into the kit: `start-arena.bat` / `.sh` (start the event), `start-vibe-hackathon.bat` (Vibe Hackathon on a router), `setup-hotspot.ps1` (one-time admin setup, opens ports 4000 and 4001), `start-hotspot.ps1`. |

The kit's own guide is [docs/EVENT_DAY.md](../docs/EVENT_DAY.md) (copied in as `README.txt`).
