import { expect, test, type Browser, type Page } from "@playwright/test";

// Tile Rush (/competitions/vibecoding/). The arena starts with an empty competitions folder (see playwright.config.ts).
const PIN = "2468";
const BASE = "/competitions/vibecoding";

const newId = (() => {
  let n = 0;
  const run = Date.now().toString(36).slice(-5).toUpperCase();
  return () => `V${run}${(n++).toString(36).toUpperCase()}`.slice(0, 10);
})();

async function hostPage(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(`${BASE}/host/`);
  await page.locator("input").first().fill(PIN);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Tile Rush · host")).toBeVisible();
  return page;
}

async function phone(browser: Browser, name: string) {
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
  return page;
}

async function createTeam(page: Page, name: string) {
  await page.getByPlaceholder("Team name").fill(name);
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page.getByText(name)).toBeVisible();
  return (await page.locator(".font-mono").first().innerText()).trim();
}

test("Tile Rush scaffold: host opens registration, a team forms, the wall shows it", async ({ browser }) => {
  const host = await hostPage(browser);
  const screenCtx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const wall = await screenCtx.newPage();
  await wall.goto(`${BASE}/screen/`);
  await expect(wall.getByText("Tile Rush")).toBeVisible();

  await host.getByRole("button", { name: "Open registration" }).click();
  const a = await phone(browser, "Asha Menon");
  const code = await createTeam(a, "Byte Me");
  const b = await phone(browser, "Binu Raj");
  await b.getByPlaceholder("CODE").fill(code);
  await b.getByRole("button", { name: "Join", exact: true }).click();
  await expect(b.getByText("Byte Me")).toBeVisible();
  await expect(a.getByText("Binu Raj")).toBeVisible();
  await expect(wall.getByText("Byte Me")).toBeVisible();
});
