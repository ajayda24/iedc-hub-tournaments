// Bundles the arena server into a single ESM file (no node_modules needed on the event laptop),
// plus checks-worker.cjs next to it: the Tile Rush check runner (jsdom) in its own worker thread.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outfile = process.argv[2] ?? path.join(here, "dist", "arena.mjs");
const workerFile = path.join(path.dirname(outfile), "checks-worker.cjs");

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

/** jsdom reads two files from disk at runtime; a single-file bundle can't, so inline/skip them. */
const jsdomFix = {
  name: "jsdom-fix",
  setup(b) {
    b.onLoad({ filter: /style-rules\.js$/ }, (args) => {
      if (!args.path.includes("jsdom")) return undefined;
      const css = fs.readFileSync(path.resolve(path.dirname(args.path), "../../browser/default-stylesheet.css"), "utf8");
      const src = fs.readFileSync(args.path, "utf8");
      const out = src.replace(/fs\.readFileSync\(\s*path\.resolve\(__dirname, "\.\.\/\.\.\/browser\/default-stylesheet\.css"\),\s*\{ encoding: "utf-8" \}\s*\)/, JSON.stringify(css));
      if (out === src) throw new Error("jsdom-fix: default stylesheet read not found (jsdom changed?)");
      return { contents: out, loader: "js" };
    });
    // sync XHR needs a helper file; the checks stub XHR anyway
    b.onLoad({ filter: /XMLHttpRequest-impl\.js$/ }, (args) => {
      const src = fs.readFileSync(args.path, "utf8");
      const out = src.replace(/const syncWorkerFile = require\.resolve \? require\.resolve\("\.\/xhr-sync-worker\.js"\) : null;/, "const syncWorkerFile = null;");
      if (out === src) throw new Error("jsdom-fix: sync XHR worker line not found (jsdom changed?)");
      return { contents: out, loader: "js" };
    });
  },
};

await build({
  entryPoints: [path.join(here, "src", "competitions", "vibecoding", "checks", "worker.ts")],
  outfile: workerFile,
  bundle: true,
  platform: "node",
  // CommonJS, and without a global "use strict": jsdom's CSS code relies on sloppy-mode assignments
  format: "cjs",
  target: "node20",
  minify: true,
  legalComments: "none",
  external: ["canvas", "bufferutil", "utf-8-validate"],
  plugins: [jsdomFix],
  logLevel: "info",
});
fs.writeFileSync(workerFile, fs.readFileSync(workerFile, "utf8").replace(/^"use strict";/, ""));
