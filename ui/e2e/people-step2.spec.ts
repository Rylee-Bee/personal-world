/**
 * People, step 2 (roles step 2): inviting with a one-time link, a guest's
 * visit dates, limits for someone supervised, and letting someone help.
 * Made-up people only.
 */
import { test, expect } from "./test";
import type { Locator, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ request }) => {
  await request.delete("/api/__test/reset");
});

async function settings(page: Page) {
  await page.goto("/");
  await page.getByRole("navigation", { name: "World navigation" }).getByRole("button", { name: "Settings" }).click();
}

async function confirmKey(scope: Locator) {
  await scope.getByLabel("Your sign-in key").fill("made-up-key");
  await scope.getByRole("button", { name: "Confirm", exact: true }).click();
}

test("inviting someone shows their one-time link once, and it can be cancelled", async ({ page }) => {
  await settings(page);
  await page.getByRole("button", { name: "Open people" }).click();
  const section = page.getByRole("region", { name: "Invite someone" });
  await section.getByRole("button", { name: "Invite someone" }).click();
  await section.getByLabel("Their name").fill("Alex");
  await section.getByRole("button", { name: "Make the link" }).click();
  await confirmKey(section);

  await expect(section.getByRole("status").filter({ hasText: "Here’s Alex’s link." })).toBeVisible();
  await expect(section.getByLabel("Alex’s link", { exact: true })).toHaveValue(/\/invite#made-up-one-time-code$/);
  await expect(section.getByText("Links not used yet · 1")).toBeVisible();

  await section.getByRole("button", { name: "Cancel Alex’s link" }).click();
  await expect(section.getByText(/Links not used yet/)).toHaveCount(0);

  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
});

test("a guest shows their visit date, and someone supervised can get limits", async ({ page }) => {
  await settings(page);
  await page.getByRole("button", { name: "Open people" }).click();
  const main = page.getByRole("main", { name: "People" });
  await expect(main.getByText(/^Visiting until /)).toBeVisible();

  await main.getByRole("button", { name: "Set limits for Robin" }).click();
  const group = main.getByRole("group", { name: "Limits for Robin" });
  await group.getByRole("button", { name: "Save Robin’s limits" }).click();
  await confirmKey(group);
  await expect(main.getByRole("status").filter({ hasText: "Saved Robin’s limits." })).toBeVisible();
});

test("letting someone help: choose, see them helping, stop now, and the log", async ({ page }) => {
  await settings(page);
  await page.getByRole("button", { name: "Open helpers" }).click();
  const main = page.getByRole("main", { name: "Let someone help me" });

  await main.getByLabel("Who", { exact: true }).selectOption({ label: "Jo" });
  await main.getByRole("button", { name: "Let Jo help" }).click();
  await confirmKey(main);
  await expect(main.getByRole("status").filter({ hasText: "Jo can see what needs you until" })).toBeVisible();
  await expect(main.getByText("Helping you now · 1")).toBeVisible();

  await main.getByRole("button", { name: "Stop Jo’s help now" }).click();
  await expect(main.getByText("Helping you now · 0")).toBeVisible();
  await expect(main.getByText("Jo marked “Backups finished” as seen.")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
