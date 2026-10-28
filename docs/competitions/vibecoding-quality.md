# Vibe Hackathon: AI quality runs

Each run is `pnpm vibecoding:quality` (spec 16.6). Newest first.

## Run 2026-10-28 07:28 UTC (through the gateway)

| Model | pass@1 | pass@3 | Latency p50 / p95 | System instruction | Gate |
|---|---|---|---|---|---|
| gateway | 54% | 100% | 16.4 s / 24.5 s | yes, yes, yes | ✅ met |

Per tile (prompts passed within 3 Asks, out of 3):

| Tile | gateway |
|---|---|
| Hero banner | 3/3 |
| Countdown | 3/3 |
| Schedule | 3/3 |
| Registration form | 3/3 |
| Dark/light switch | 3/3 |
| Gallery | 3/3 |
| Feedback stars | 3/3 |
| Fix-it | 3/3 |

By level (pass@3): vague 100%, medium 100%, detailed 100%

## Run 2026-10-28 03:13 UTC

| Model | pass@1 | pass@3 | Latency p50 / p95 | System instruction | Gate |
|---|---|---|---|---|---|
| gemma-4-26b-a4b-it | 46% | 96% | 19.7 s / 25.1 s | yes | ✅ met |
| gemma-4-31b-it | 4% | 21% | 82.2 s / 121.2 s | yes | ❌ not met |
| gemini-3.1-flash-lite | 46% | 83% | 5.8 s / 47.9 s | yes | (overflow) |
| gemini-3.5-flash-lite | 63% | 96% | 3.1 s / 53.6 s | yes | (overflow) |

Per tile (prompts passed within 3 Asks, out of 3):

| Tile | gemma-4-26b-a4b-it | gemma-4-31b-it | gemini-3.1-flash-lite | gemini-3.5-flash-lite |
|---|---|---|---|---|
| Hero banner | 2/3 | 0/3 ⚠️ | 2/3 | 3/3 |
| Countdown | 3/3 | 0/3 ⚠️ | 0/3 ⚠️ | 3/3 |
| Schedule | 3/3 | 1/3 ⚠️ | 3/3 | 3/3 |
| Registration form | 3/3 | 0/3 ⚠️ | 3/3 | 2/3 |
| Dark/light switch | 3/3 | 3/3 | 3/3 | 3/3 |
| Gallery | 3/3 | 0/3 ⚠️ | 3/3 | 3/3 |
| Feedback stars | 3/3 | 0/3 ⚠️ | 3/3 | 3/3 |
| Fix-it | 3/3 | 1/3 ⚠️ | 3/3 | 3/3 |

By level (pass@3): vague 72%, medium 69%, detailed 81%

