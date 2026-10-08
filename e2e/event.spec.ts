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

/** A fresh Student ID for this run (students.json survives between runs). */
const newId = (() => {
  let n = 0;
  const run = Date.now().toString(36).slice(-5).toUpperCase();
  return () => `T${run}${(n++).toString(36).toUpperCase()}`.slice(0, 10);
})();

async function phone(browser: Browser, opts: { internet?: () => boolean } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route(/gstatic|cloudflare|google\.com/, (r) => (opts.internet?.() ? r.fulfill({ status: 204, body: "" }) : r.abort()));
  const page = await ctx.newPage();
  await page.goto("/play/");
  return page;
}

async function fillDetails(page: Page, name: string, dept: string, studentId: string) {
  await page.locator("input[autocomplete=name]").fill(name);
  await page.locator("input[autocomplete=username]").fill(studentId);
  await page.getByRole("button", { name: "S3", exact: true }).click();
  await page.getByRole("button", { name: dept, exact: true }).click();
  await page.getByRole("button", { name: /Next/ }).click();
}

async function createPin(page: Page, pin: string) {
  await expect(page.getByText("Create your PIN")).toBeVisible();
  await expect(page.getByText("Save your PIN now")).toBeVisible();
  const boxes = page.locator("input[type=password]");
  await boxes.nth(0).fill(pin);
  await boxes.nth(1).fill(pin);
  await page.getByRole("button", { name: /Create PIN/ }).click();
}

async function player(browser: Browser, name: string, dept: string, opts: { internet?: () => boolean } = {}) {
  const page = await phone(browser, opts);
  await fillDetails(page, name, dept, newId());
  await createPin(page, "1357");
  await expect(page.getByText("You're in")).toBeVisible();
  return page;
}

async function typeWord(page: Page, word: string) {
  for (const ch of word.toUpperCase()) await page.keyboard.press(ch);
}

test("a full anagram round: synced start, scoring, results on every device", async ({ browser }) => {
  const host = await hostPage(browser);
  const anjali = await player(browser, "Anjali Nair", "CSE");
  const rahul = await player(browser, "Rahul K", "EEE");
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

test("student ID + PIN: rejoin on another phone keeps the score, host can reset the PIN, monthly board publishes", async ({ browser }) => {
  const host = await hostPage(browser);
  const id = newId();

  // first phone: create the PIN
  const first = await phone(browser);
  await fillDetails(first, "Meera Joseph", "IT", id);
  await createPin(first, "4826");
  await expect(first.getByText("You're in")).toBeVisible();
  await host.getByRole("button", { name: "+100" }).first().click();
  await expect(first.locator("header").getByText("100", { exact: true })).toBeVisible();

  // second phone: wrong PIN is refused, right PIN brings the same score
  const second = await phone(browser);
  await fillDetails(second, "Meera Joseph", "IT", id.toLowerCase());
  await expect(second.getByText("Welcome back!")).toBeVisible();
  await second.locator("input[type=password]").fill("0000");
  await second.getByRole("button", { name: /Jump in/ }).click();
  await expect(second.getByText(/Wrong PIN/)).toBeVisible();
  await second.locator("input[type=password]").fill("4826");
  await second.getByRole("button", { name: /Jump in/ }).click();
  await expect(second.getByText("You're in")).toBeVisible();
  await expect(second.locator("header").getByText("100", { exact: true })).toBeVisible();
  await expect(first.getByText("This tab is asleep")).toBeVisible();

  // host resets the PIN → next join creates a new one
  await host.getByRole("button", { name: "Students", exact: true }).click();
  await host.getByPlaceholder(/Search Student ID/).fill(id);
  await host.getByRole("button", { name: "reset PIN" }).click();
  const third = await phone(browser);
  await fillDetails(third, "Meera Joseph", "IT", id);
  await createPin(third, "9090");
  await expect(third.getByText("You're in")).toBeVisible();

  // monthly: record, download for the website (no Student IDs), public page shows it
  await host.getByRole("button", { name: "Monthly", exact: true }).click();
  await host.getByRole("button", { name: "Record this tournament now" }).click();
  await expect(host.getByText("Meera Joseph").first()).toBeVisible();
  const [download] = await Promise.all([host.waitForEvent("download"), host.getByRole("button", { name: "Download for website" }).click()]);
  const published = fs.readFileSync(await download.path(), "utf8");
  expect(published).toContain("Meera Joseph");
  expect(published).not.toContain(id);

  const board = await host.context().newPage();
  await board.goto("/leaderboard/");
  await expect(board.getByTestId("last-updated")).toContainText("Last updated");
  await expect(board.getByText("Meera Joseph").first()).toBeVisible();
});
