import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { TASKS } from "../packages/shared/src/competitions/vibecoding/config";
import { BASE, createTeam, doTile, hostPage, joinTeam, phone, solvePuzzle } from "./vc-helpers";

// The whole Tile Rush event (spec 16.4): three teams of 2, 3 and 4, the mock AI (fast, 1 s cooldown; see playwright.config.ts).
const TITLES = ["Hero banner", "Countdown", "Schedule", "Registration form", "Dark/light switch", "Gallery", "Feedback stars", "Fix-it"];

test("the whole event: three teams, every stage, host controls, wall, gallery, voting, export", async ({ browser }) => {
  test.setTimeout(400_000);
  const host = await hostPage(browser);
  await host.getByRole("button", { name: "Start a new run" }).click();
  const wall = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  await wall.goto(`${BASE}/screen/`);
  await host.getByRole("button", { name: "Open registration" }).click();

  // registration: teams of 2, 3 and 4
  const a1 = await phone(browser, "Anu Mary");
  const codeA = await createTeam(a1, "Alpha Duo");
  await joinTeam(await phone(browser, "Abel Jose"), codeA, "Alpha Duo");
  const b1 = await phone(browser, "Bindu K");
  const codeB = await createTeam(b1, "Beta Trio");
  for (const n of ["Basil T", "Bency R"]) await joinTeam(await phone(browser, n), codeB, "Beta Trio");
  const c1 = await phone(browser, "Cyril M");
  const codeC = await createTeam(c1, "Gamma Four");
  const cs = [c1];
  for (const n of ["Chitra P", "Clint S", "Cini V"]) {
    const p = await phone(browser, n);
    await joinTeam(p, codeC, "Gamma Four");
    cs.push(p);
  }
  await expect(wall.getByText("Gamma Four")).toBeVisible();
  await expect(wall.getByText("Cyril M, Chitra P, Clint S, Cini V")).toBeVisible();

  // host: take a member out of a team and put them back (People tab)
  await host.getByRole("button", { name: /^People/ }).click();
  const row = host.getByRole("row").filter({ hasText: "Cini V" });
  await row.getByRole("button", { name: "Remove from team" }).click();
  await expect(cs[3].getByText("Start a team")).toBeVisible();
  await row.getByRole("combobox").selectOption({ label: "Gamma Four" });
  await expect(cs[3].getByText("Gamma Four").first()).toBeVisible();

  // warm-up, then the build
  await host.getByRole("button", { name: "Control" }).click();
  await host.getByRole("button", { name: "Start warm-up" }).click();
  await host.getByRole("button", { name: "Start the build clock" }).click();
  await expect(wall.getByText("Leaderboard")).toBeVisible();

  // pause, resume, extend
  await host.getByRole("button", { name: /Pause/ }).click();
  await expect(a1.getByText("The clock is paused.")).toBeVisible();
  await host.getByRole("button", { name: /Resume/ }).click();
  await expect(a1.getByText("The clock is paused.")).toBeHidden();
  await host.getByRole("button", { name: "+5 min" }).click();
  await expect(host.locator("header").getByText(/^10[45]:\d\d$/)).toBeVisible();

  // Alpha: all 8 tiles through the (mock) AI
  await doTile(a1, TITLES[0]);
  await expect(wall.getByText(/First Blood!/)).toBeVisible();
  for (const title of TITLES.slice(1)) await doTile(a1, title);
  await expect(a1.getByRole("button", { name: /Puzzle/ }).first()).toBeVisible();

  // Gamma: one tile, then the host resets the team
  await doTile(c1, "Gallery");
  await host.getByRole("button", { name: /^Teams/ }).click();
  await host.getByRole("row").filter({ hasText: "Gamma Four" }).click();
  await expect(host.getByRole("row").filter({ hasText: "Gamma Four" })).toContainText("1/8");
  await host.getByRole("button", { name: "Reset team" }).click();
  await expect(host.getByRole("row").filter({ hasText: "Gamma Four" })).toContainText("0/8");

  // Beta: the host unlocks all 8 tiles
  await host.getByRole("row").filter({ hasText: "Beta Trio" }).click();
  for (let i = 0; i < 8; i++) await host.getByRole("button", { name: "Unlock", exact: true }).first().click();
  await expect(host.getByRole("row").filter({ hasText: "Beta Trio" })).toContainText("8/8");

  // the wall: Alpha leads (bonuses beat plain unlocks)
  const lb = wall.locator("ol li");
  await expect(lb.first()).toContainText("Alpha Duo");
  await expect(lb.nth(1)).toContainText("Beta Trio");
  await expect(lb.nth(2)).toContainText("Gamma Four");

  // Alpha: puzzle, publish, the client's change request, publish again
  await a1.getByRole("button", { name: /Puzzle/ }).first().click();
  await solvePuzzle(a1);
  await a1.getByRole("button", { name: /Publish/ }).click();
  await a1.getByRole("button", { name: "Publish now" }).click();
  await expect(a1.getByText("Your site is live!")).toBeVisible({ timeout: 30_000 });
  await expect(a1.getByText(/The client called/).first()).toBeVisible();
  const crText = await a1.getByText(/Please add the line/).first().innerText();
  const phrase = TASKS.changeRequests.find((c) => crText.includes(c.phrase))!.phrase;
  await a1.getByRole("button", { name: /Board/ }).click();
  await a1.getByRole("button", { name: /^Hero banner:/ }).click();
  await a1.getByPlaceholder(/Describe what you want/).fill(`Please add the line "${phrase}" to the page`);
  await a1.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(a1.getByText(/Bulbu says/)).toBeVisible({ timeout: 20_000 });
  await a1.getByRole("button", { name: /Board/ }).click();
  await a1.getByRole("button", { name: /Publish/ }).first().click();
  await a1.getByRole("button", { name: "Publish again" }).click();
  await expect(a1.getByText(/Change request done!/)).toBeVisible({ timeout: 30_000 });

  // Beta: puzzle and publish
  await b1.getByRole("button", { name: /Puzzle/ }).first().click();
  await solvePuzzle(b1);
  await b1.getByRole("button", { name: /Publish/ }).click();
  await b1.getByRole("button", { name: "Publish now" }).click();
  await expect(b1.getByText("Your site is live!")).toBeVisible({ timeout: 30_000 });

  // the gallery on the sites port lists both; a published site really works
  const sites = await (await browser.newContext()).newPage();
  await sites.goto("http://localhost:4101/sites/");
  await expect(sites.getByText("Alpha Duo")).toBeVisible();
  await expect(sites.getByText("Beta Trio")).toBeVisible();
  await sites.getByText("Alpha Duo").click();
  await expect(sites.getByText("IEDC Fest 2026")).toBeVisible();
  await expect(sites.getByText(phrase)).toBeVisible();
  await sites.locator('[data-hook="star"]').nth(2).click();
  await expect(sites.getByText("You rated: 3/5")).toBeVisible();

  // freeze, showcase, voting
  await host.getByRole("button", { name: "Control" }).click();
  await host.getByRole("button", { name: "Freeze now" }).click();
  await expect(wall.getByText("Time's up").first()).toBeVisible();
  await host.getByRole("button", { name: "Open showcase" }).click();
  await expect(wall.getByText("Awards")).toBeVisible();
  await expect(wall.getByText("Champion")).toBeVisible();
  await expect(a1.getByText("Plot twist: you were coding all along")).toBeVisible();
  await host.getByRole("button", { name: "Showcase" }).click();
  await host.getByRole("button", { name: "Alpha Duo" }).click();
  await expect(wall.frameLocator("iframe").getByText("IEDC Fest 2026")).toBeVisible();
  await host.getByRole("button", { name: /Open voting/ }).click();
  await expect(c1.getByText("Vote: Best-Looking Site")).toBeVisible();
  await c1.getByRole("button", { name: "Vote" }).first().click();
  await expect(c1.getByText("Thanks for voting!")).toBeVisible();
  await expect(host.getByText(/: 1$/).first()).toBeVisible();

  // close: the results are exported on the laptop
  await host.getByRole("button", { name: "Control" }).click();
  await host.getByRole("button", { name: "Close the event" }).click();
  const runs = path.join(".e2e-data", "competitions", "vibecoding", "runs");
  await expect.poll(() => fs.existsSync(runs) && fs.readdirSync(runs).length > 0).toBe(true);
  const latest = fs
    .readdirSync(runs)
    .map((d) => path.join(runs, d))
    .sort((x, y) => fs.statSync(y).mtimeMs - fs.statSync(x).mtimeMs)[0];
  const csv = fs.readFileSync(path.join(latest, "results.csv"), "utf8");
  expect(csv).toContain("Beta Trio");
  expect(csv).toContain("Gamma Four");
  expect(csv.split(/\r?\n/)[1]).toMatch(/^1,Alpha Duo,2,/);
});
