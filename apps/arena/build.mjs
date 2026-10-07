// Bundles the arena server into a single ESM file (no node_modules needed on the event laptop).
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outfile = process.argv[2] ?? path.join(here, "dist", "arena.mjs");

await build({
  entryPoints: [path.join(here, "src", "index.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  minify: true,
  legalComments: "none",
  // optional native speed-ups for `ws`; it works fine without them
  external: ["bufferutil", "utf-8-validate"],
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  logLevel: "info",
});
