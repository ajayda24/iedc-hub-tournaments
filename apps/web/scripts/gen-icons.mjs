// Renders public/icons/icon.svg to the PNG sizes the web manifest needs.
// Uses the Chromium that Playwright ships (or set CHROME_PATH).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const svg = fs.readFileSync(path.join(dir, "icon.svg"), "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage();
for (const [name, size, pad] of [["icon-192.png", 192, 0], ["icon-512.png", 512, 0], ["icon-maskable-512.png", 512, 56]]) {
  await page.setViewportSize({ width: size, height: size });
  const inner = size - pad * 2;
  await page.setContent(
    `<body style="margin:0;background:#fffbf2;display:grid;place-items:center;width:${size}px;height:${size}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</body>`,
  );
  await page.screenshot({ path: path.join(dir, name), omitBackground: false });
  console.log("wrote", name);
}
await browser.close();
