/**
 * Owner walk-through, round 2 (2026-09-27): every screen has an address and
 * back/forward move between screens; slow screens show a calm sign they're
 * working; Remember is labelled on phones; Rough night fits a phone; the
 * Library's italic words can be tapped to learn them.
 */
import { test, expect } from "./test";
import { gotoArea } from "./helpers";

test("every screen has an address, and back/forward move between screens", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/#bridge$/);
  await gotoArea(page, "Memory");
  await expect(page).toHaveURL(/#memory$/);
  await page.getByRole("navigation", { name: "World navigation" }).getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/#settings$/);
  await page.getByRole("button", { name: "Open the Library" }).click();
  await expect(page).toHaveURL(/#library$/);
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Memory" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  // A bookmark opens that screen, and keeps other query words.
  await page.goto("/?room=studio#computers");
  await expect(page.getByRole("heading", { level: 1, name: "Computers" })).toBeVisible();
  await page.goto("/#library");
  await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();
  // An unknown address is the Bridge, not an error.
  await page.goto("/#nowhere");
  await expect(page.getByRole("main")).toHaveAttribute("aria-label", "Bridge");
});

test("a slow screen shows a calm sign that it's working", async ({ page }) => {
  await page.route("**/api/rooms", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.fallback();
  });
  await page.goto("/#computers");
  await expect(page.getByRole("status").filter({ hasText: "Finding the Engine room…" })).toBeVisible();
  await expect(page.locator(".pw-skeleton").first()).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("on a phone: Remember is labelled, and Rough night can be reached and fits", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const remember = page.getByRole("button", { name: "Remember" });
  await expect(remember).toBeVisible();
  await expect(remember).toContainText("Remember");
  await page.getByRole("navigation", { name: "World navigation" }).getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Open rough night" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Rough night" })).toBeVisible();
  await page.screenshot({ path: "test-results/rough-night-390.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  const save = page.getByRole("button", { name: "Save for my doctor" });
  const box = await save.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test("Library: an italic word in a Worlds book can be tapped to learn it", async ({ page }) => {
  await page.goto("/#library");
  await page.getByRole("button", { name: "Open How Worlds fits together" }).click();
  const plugin = page.getByRole("button", { name: "plugin", exact: true });
  await expect(plugin).toBeVisible();
  await plugin.click();
  await expect(page.getByRole("status").filter({ hasText: /swappable tool/i })).toBeVisible();
});
