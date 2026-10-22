/**
 * Upgrading a laptop: an old kit's arena-data/ (PINs, tournament history) is
 * copied into a freshly built kit, which is then started from a different
 * folder with no --data flag. The returning student must still be recognised
 * with their old PIN, and the old tournament must still be on the monthly board.
 *
 * Needs a built kit: `pnpm kit --no-zip` first. Skipped when there isn't one.
 */
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { Students } from "../apps/arena/src/students";
import { History } from "../apps/arena/src/history";

const kits = fs.existsSync("dist") ? fs.readdirSync("dist").filter((d) => d.startsWith("event-kit-") && !d.endsWith(".zip")) : [];
const PORT = 4150;

test.skip(kits.length === 0, "no built kit in dist/ (run pnpm kit --no-zip)");

test("an old arena-data folder keeps working in a new kit", async ({ browser }) => {
  // a throwaway copy of the built kit
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kit-upgrade-"));
  const kit = path.join(tmp, "kit");
  fs.cpSync(path.join("dist", kits[0]), kit, { recursive: true, filter: (src) => !/[\\/](arena-data|backups)([\\/]|$)/.test(src) });

  // "old laptop" data, written by the real classes
  const data = path.join(kit, "arena-data");
  fs.mkdirSync(data);
  const students = new Students(data);
  expect(students.verifyOrCreate("OLD123", "4826", { name: "Old Timer", dept: "CSE", sem: "S5" }).ok).toBe(true);
  const history = new History(data);
  history.record({ id: "old-1", name: "Old Cup", players: [{ studentId: "OLD123", name: "Old Timer", dept: "CSE", sem: "S5", score: 2468, rank: 1, solves: 3 }] });

  let server: ChildProcess | null = null;
  const start = async (...extra: string[]) => {
    // started from the temp folder, NOT the kit folder, and without --data
    server = spawn(process.execPath, [path.join(kit, "app", "arena.mjs"), "--port", String(PORT), "--pin", "2468", ...extra], { cwd: tmp });
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(`http://localhost:${PORT}/api/health`)).ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error("kit server didn't start");
  };
  const stop = () => new Promise<void>((r) => (server?.once("exit", () => r()), server?.kill()));

  try {
    await start();
    const board = await (await fetch(`http://localhost:${PORT}/api/leaderboard`)).json();
    expect(Object.values(board.months).flatMap((m: any) => m.standings.map((s: any) => [s.name, s.points]))).toContainEqual(["Old Timer", 2468]);

    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await page.route(/gstatic|cloudflare|google\.com/, (r) => r.abort());
    await page.goto(`http://localhost:${PORT}/play/`);
    await page.locator("input[autocomplete=name]").fill("Old Timer");
    await page.locator("input[autocomplete=username]").fill("old123");
    await page.getByRole("button", { name: "S5", exact: true }).click();
    await page.getByRole("button", { name: "CSE", exact: true }).click();
    await page.getByRole("button", { name: /Next/ }).click();
    await expect(page.getByText("Welcome back!")).toBeVisible();
    await page.locator("input[type=password]").first().fill("4826");
    await page.keyboard.press("Enter");
    await expect(page.getByText("You're in")).toBeVisible();

    // --fresh clears the event but never the PINs or the history
    await stop();
    await start("--fresh");
    expect(fs.existsSync(path.join(data, "students.json"))).toBe(true);
    const after = await (await fetch(`http://localhost:${PORT}/api/leaderboard`)).json();
    expect(JSON.stringify(after)).toContain("Old Timer");
  } finally {
    await stop();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
