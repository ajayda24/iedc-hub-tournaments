import fs from "node:fs";
import path from "node:path";

/**
 * The Gemini API key: the GEMINI_API_KEY environment variable, or the key the
 * host pasted in the console (saved in the competition's data folder, which is
 * private and never committed).
 */
export const keyFile = (dir: string) => path.join(dir, "gemini-key.txt");

export function readKey(dir: string, env = process.env): string | null {
  if (env.GEMINI_API_KEY?.trim()) return env.GEMINI_API_KEY.trim();
  try {
    const k = fs.readFileSync(keyFile(dir), "utf8").trim();
    return k || null;
  } catch {
    return null;
  }
}

export function saveKey(dir: string, key: string) {
  fs.mkdirSync(dir, { recursive: true });
  if (!key) fs.rmSync(keyFile(dir), { force: true });
  else fs.writeFileSync(keyFile(dir), `${key.trim()}\n`, { mode: 0o600 });
}
