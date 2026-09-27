/**
 * Your lore: grouped by title and section, "waiting for you" first, one tap
 * to confirm (the step-up gate is stood in by a route), gone items quiet
 * at the end, and checking for changes at the top. Made-up lore only.
 */
import { test, expect } from "./test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gotoArea } from "./helpers";

const AT = "2026-09-27T09:00:00Z";
const item = (key: string, text: string, title: string, section: string, state: string, extra: object = {}) => ({
  key, text, title, section, state, kind: "claim", status: "candidate", file: "people.md", source: "lore", observed_at: AT, ...extra,
});

async function withLore(page: Page) {
  const items = [
    item("lore:1", "Sam likes a quiet morning before any messages.", "Mornings", "Routines", "suggested", { status: "accepted" }),
    item("lore:2", "Tea, not coffee, after ten.", "Mornings", "Routines", "suggested"),
    item("lore:3", "Walks the dog with Jo on Saturdays.", "People", "Friends", "confirmed", { status: "accepted" }),
    item("lore:4", "Prefers short answers first, detail on request.", "People", "How to talk to me", "suggested", { kind: "profile" }),
    item("lore:5", "Used to keep bees.", "Mornings", "", "suggested", { gone: true }),
  ];
  const confirmed: string[][] = [];
  await page.route("**/api/lore", (route) => {
    const counts: Record<string, number> = {};
    for (const i of items) counts[i.state] = (counts[i.state] ?? 0) + 1;
    return route.fulfill({ json: { ok: true, data: { items, counts, accepted_waiting: 1 } } });
  });
  await page.route("**/api/lore/confirm", (route) => {
    const { keys } = route.request().postDataJSON();
    confirmed.push(keys);
    for (const k of keys) items.find((i) => i.key === k)!.state = "confirmed";
    return route.fulfill({ json: { ok: true, data: { confirmed: keys.length, skipped: 0 } } });
  });
  return confirmed;
}

test("Your lore: grouped, waiting first, one tap to confirm, gone items quiet", async ({ page }) => {
  const confirmed = await withLore(page);
  await gotoArea(page, "Memory");
  await expect(page.getByText("Your lore: 1 confirmed · 3 waiting for you")).toBeVisible();
  await page.getByRole("button", { name: "Open your lore" }).click();
  const main = page.getByRole("main", { name: "Your lore" });
  await expect(main.getByRole("heading", { level: 1, name: "Your lore" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Waiting for you · 3" })).toHaveAttribute("aria-pressed", "true");
  await expect(main.getByRole("heading", { level: 2, name: "Mornings" })).toBeVisible();
  await expect(main.getByRole("heading", { level: 3, name: "Routines" })).toBeVisible();
  await expect(main.getByText("Marked accepted in your files", { exact: false }).first()).toBeVisible();
  // Confirmed things aren't in the waiting view; gone things sit quietly at the end.
  await expect(main.getByText("Walks the dog with Jo on Saturdays.")).toBeHidden();
  await expect(main.getByText("No longer in your lore files · 1")).toBeVisible();
  await expect(main.getByText("Used to keep bees.")).toBeHidden();
  await expect(main.getByRole("button", { name: "Check for changes" })).toBeVisible();
  await expect(main.getByText("1 confirmed · 3 waiting for you", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/lore-1440.png", fullPage: true });
  let results = await new AxeBuilder({ page }).analyze();
  let bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);

  await main.getByRole("button", { name: "Confirm: Prefers short answers first, detail on request." }).click();
  await expect(main.getByRole("status").filter({ hasText: "Confirmed: Prefers short answers first, detail on request." })).toBeVisible();
  await main.getByRole("button", { name: "Confirm all 2 in Mornings" }).click();
  await expect(main.getByRole("status").filter({ hasText: "Confirmed 2 things in Mornings." })).toBeVisible();
  expect(confirmed).toEqual([["lore:4"], ["lore:1", "lore:2"]]);
  await expect(main.getByText("Nothing is waiting for you.", { exact: false })).toBeVisible();

  await main.getByRole("button", { name: /^Confirmed · 4/ }).click();
  await expect(main.getByText("Walks the dog with Jo on Saturdays.")).toBeVisible();
  await main.getByLabel("Find in your lore").fill("dog");
  await expect(main.getByText("Tea, not coffee, after ten.")).toBeHidden();
  results = await new AxeBuilder({ page }).analyze();
  bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);

  await main.getByRole("button", { name: "Back to Memory" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Memory" })).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("Your lore fits a phone, and Settings opens it too", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await withLore(page);
  await gotoArea(page, "Settings");
  await page.getByRole("button", { name: "Open your lore" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your lore" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to Settings" })).toBeVisible();
  await page.screenshot({ path: "test-results/lore-390.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
