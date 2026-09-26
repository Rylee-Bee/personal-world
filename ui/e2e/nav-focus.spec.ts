/**
 * Navigation for keyboard and screen-reader users, and on phones:
 * after choosing a page, focus lands on its heading; on a phone every
 * personal section is on screen, not hidden past a scroller's edge.
 */
import { test, expect } from "./test";

test.beforeEach(async ({ request }) => {
  await request.delete("/api/__test/reset");
});

test("choosing a page moves focus to its heading", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "World navigation" });
  await nav.getByRole("button", { name: "Memory" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Memory" })).toBeFocused();
  await nav.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeFocused();
});

test("the first load leaves focus alone, so Skip to main content comes first", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
});

test("on a phone, every personal section is on screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const personal = page.getByRole("list", { name: "Personal sections" }).getByRole("button");
  const count = await personal.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const box = await personal.nth(i).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
