// Writes .gz and .br next to every text asset in a static build, so the arena
// laptop can serve compressed files to 80 phones without spending CPU on it.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve(process.argv[2] ?? "out");
const EXT = new Set([".js", ".css", ".html", ".svg", ".json", ".txt", ".webmanifest", ".map"]);
let files = 0;
let saved = 0;
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (EXT.has(path.extname(e.name)) && !e.name.endsWith(".map")) {
      const buf = fs.readFileSync(p);
      if (buf.length < 1024) continue;
      const gz = zlib.gzipSync(buf, { level: 9 });
      const br = zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } });
      fs.writeFileSync(p + ".gz", gz);
      fs.writeFileSync(p + ".br", br);
      files++;
      saved += buf.length - br.length;
    }
  }
}
walk(root);
console.log(`precompressed ${files} files in ${path.relative(process.cwd(), root) || "."} (saves ~${Math.round(saved / 1024)} KB per full load)`);
