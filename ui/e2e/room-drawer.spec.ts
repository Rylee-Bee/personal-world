/**
 * The room drawer (Spec-Drawer): opened from a doorway, a labelled
 * non-modal dialog; full axe rule set with no suppressions; Escape
 * closes it and focus returns to the doorway's Look inside button.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ request }) => {
  await request.delete("/api/__test/reset");
});

test("the drawer opens, passes axe, and Escape returns focus", async ({ page }) => {
  await page.goto("/");
  const opener = page.getByRole("button", { name: "Look inside Studio" });
  await opener.click();
  const drawer = page.getByRole("dialog", { name: "Studio" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("heading", { level: 2, name: "Studio" })).toBeFocused();
  await expect(drawer.getByText("Confirm the transfer", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Good news")).toBeVisible();
  // An unsafe link is never offered.
  await expect(drawer.getByRole("link", { name: /Weekly word count/ })).toHaveCount(0);

  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("the drawer fits a phone without sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Look inside Studio" }).click();
  await expect(page.getByRole("dialog", { name: "Studio" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
