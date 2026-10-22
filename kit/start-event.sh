#!/usr/bin/env sh
# Start the event on macOS / Linux. Turn on your hotspot first (or join the event Wi-Fi).
# Everything this laptop remembers lives in arena-data/ next to this file.
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Node.js 20+ is required: https://nodejs.org"; exit 1; }
exec node app/arena.mjs --data arena-data "$@"
