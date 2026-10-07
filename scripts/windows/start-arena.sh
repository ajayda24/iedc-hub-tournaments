#!/usr/bin/env sh
# Brain Arena on macOS / Linux. Turn on your hotspot first (or join the event Wi-Fi).
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Node.js 20+ is required: https://nodejs.org"; exit 1; }
exec node arena.mjs "$@"
