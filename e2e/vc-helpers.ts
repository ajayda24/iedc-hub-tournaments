import { expect, type Browser, type Page } from "@playwright/test";
import { solvePath } from "../packages/shared/src/competitions/vibecoding/puzzle";

/** Helpers for the Vibe Hackathon (/competitions/vibecoding/) end-to-end tests. */
export const PIN = "2468";
export const BASE = "/competitions/vibecoding";

export const newId = (() => {
  let n = 0;
  const run = Date.now().toString(36).slice(-5).toUpperCase();
  return () => `W${run}${(n++).toString(36).toUpperCase()}`.slice(0, 10);
})();

export async function hostPage(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(`${BASE}/host/`);
  await page.locator("input").first().fill(PIN);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Vibe Hackathon · host")).toBeVisible();
  return page;
}

export async function phone(browser: Browser, name: string) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route(/gstatic|cloudflare|google\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(`${BASE}/`);
  await page.locator("input[autocomplete=name]").fill(name);
  await page.locator("input[autocomplete=username]").fill(newId());
  await page.getByRole("button", { name: "S3", exact: true }).click();
  await page.getByRole("button", { name: "CSE", exact: true }).click();
  await page.getByRole("button", { name: /Next/ }).click();
  const boxes = page.locator("input[type=password]");
  await boxes.nth(0).fill("1357");
  await boxes.nth(1).fill("1357");
  await page.getByRole("button", { name: /Create PIN/ }).click();
  await expect(page.getByText("Start a team").or(page.getByText(/Waiting for the host/)).first()).toBeVisible();
  return page;
}

export async function createTeam(page: Page, name: string) {
  await page.getByPlaceholder("Team name").fill(name);
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page.getByText(name).first()).toBeVisible();
  return (await page.locator(".font-mono").first().innerText()).trim();
}

export async function joinTeam(page: Page, code: string, name: string) {
  await page.getByPlaceholder("CODE").fill(code);
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByText(name).first()).toBeVisible();
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** Open a tile from the board, Ask, wait until every check passes, back to the board. */
export async function doTile(page: Page, title: string, ask = "Please build this section exactly as described") {
  await page.getByRole("button", { name: new RegExp(`^${escape(title)}:`) }).click();
  await page.getByPlaceholder(/Describe what you want/).fill(ask);
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText(/✓ Done/).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Board/ }).click();
}

/** Read the board from the screen and slide it home in the fewest moves. */
export async function solvePuzzle(page: Page) {
  const cells = page.getByRole("gridcell");
  await expect(cells).toHaveCount(9);
  const board = await cells.evaluateAll((els) => els.map((e) => (e.getAttribute("aria-label") === "empty" ? 0 : Number(e.getAttribute("aria-label")!.replace("piece ", "")))));
  for (const cell of solvePath(board)) {
    await cells.nth(cell).click();
    await expect(cells.nth(cell)).toHaveAttribute("aria-label", "empty");
  }
  await expect(page.getByText("🎉 Solved!")).toBeVisible();
}
