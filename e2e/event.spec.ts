import fs from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";

const PIN = "2468";
/** The arena snapshot is the only place the answers live — tests peek, players can't. */
const secret = () => JSON.parse(fs.readFileSync(".e2e-data/snapshot.json", "utf8")).round.secret;

async function hostPage(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto("/host/");
  await page.getByPlaceholder("••••").fill(PIN);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Playlist")).toBeVisible();
  // every test starts from a clean event
  await page.getByRole("button", { name: "New event" }).click();
  await expect(page.getByText("0/0 online")).toBeVisible();
  return page;
}

async function player(browser: Browser, name: string, dept: string, opts: { internet?: () => boolean } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route(/gstatic|cloudflare|google\.com/, (r) => (opts.internet?.() ? r.fulfill({ status: 204, body: "" }) : r.abort()));
  const page = await ctx.newPage();
  await page.goto("/play/");
  await page.locator("input[autocomplete=name]").fill(name);
  await page.getByRole("button", { name: "S3", exact: true }).click();
  await page.getByRole("button", { name: dept, exact: true }).click();
  await page.getByRole("button", { name: /Jump in/ }).click();
  await expect(page.getByText("You're in")).toBeVisible();
  return page;
}

async function typeWord(page: Page, word: string) {
  for (const ch of word.toUpperCase()) await page.keyboard.press(ch);
}

test("a full anagram round: synced start, scoring, results on every device", async ({ browser }) => {
  const host = await hostPage(browser);
  const anjali = await player(browser, "Anjali Nair", "CSE");
  const rahul = await player(browser, "Rahul K", "ECE");
  await expect(host.getByText("2/2 online")).toBeVisible();

  await host.getByRole("button", { name: /Start R1/ }).click();
  await expect(anjali.getByText("Anagram Blitz").first()).toBeVisible();
  await expect(anjali.getByRole("button", { name: "Skip →" })).toBeVisible({ timeout: 6000 });

  const { words } = secret() as { words: string[] };
  for (const w of words) {
    await typeWord(anjali, w);
    await anjali.waitForTimeout(250);
  }
  await expect(anjali.getByText("SOLVED", { exact: true })).toBeVisible();
  await typeWord(rahul, words[0]);
  await expect(rahul.getByText("1/6")).toBeVisible();

  await host.getByRole("button", { name: "End round now" }).click();
  await expect(rahul.getByText("the answer was")).toBeVisible();
  await expect(rahul.getByText(words[0].toUpperCase()).first()).toBeVisible();
  await expect(anjali.getByText("Nailed it.")).toBeVisible();

  await host.getByRole("button", { name: "Show podium" }).click();
  await expect(anjali.getByText("you finished")).toBeVisible();
  await expect(anjali.getByText("1st", { exact: true })).toBeVisible();
});

test("anti-cheat: internet freezes play, leaving the tab is a strike", async ({ browser }) => {
  let online = false;
  const host = await hostPage(browser);
  const sneaky = await player(browser, "Sneaky Pete", "ME", { internet: () => online });
  await host.getByRole("button", { name: /Start R1/ }).click();
  await expect(sneaky.getByRole("button", { name: "Skip →" })).toBeVisible({ timeout: 6000 });

  // leave the app for 2s
  await sneaky.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await sneaky.waitForTimeout(2000);
  await sneaky.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(sneaky.getByText("Strike one!")).toBeVisible();

  // turn on "mobile data"
  online = true;
  await expect(sneaky.getByText("Caught you")).toBeVisible({ timeout: 15_000 });
  await host.getByRole("button", { name: /Flags/ }).click();
  await expect(host.getByText("Device reached the internet").first()).toBeVisible();

  // back offline → unfreezes by itself
  online = false;
  await expect(sneaky.getByText("Caught you")).toBeHidden({ timeout: 20_000 });
  await host.getByRole("button", { name: "End round now" }).click();
});
