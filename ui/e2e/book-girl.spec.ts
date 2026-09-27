/**
 * Book Girl's setting: how to be taught, saved per person, and she holds
 * still (glowing) when motion is reduced.
 */
import { test, expect } from "./test";
import AxeBuilder from "@axe-core/playwright";
import { gotoArea } from "./helpers";

test("Settings: choose how Book Girl teaches, saved in words", async ({ page }) => {
  let mode = "build";
  const puts: string[] = [];
  await page.route("**/api/learning", (route) => route.fulfill({ json: { ok: true, data: { mode, concepts: {} } } }));
  await page.route("**/api/learning/mode", (route) => {
    mode = route.request().postDataJSON().mode;
    puts.push(mode);
    return route.fulfill({ json: { ok: true, data: { mode } } });
  });
  await gotoArea(page, "Settings");
  const section = page.getByRole("region", { name: "Book Girl" });
  await expect(section.getByRole("button", { name: "Teach me as I build" })).toHaveAttribute("aria-pressed", "true");
  await section.getByRole("button", { name: "Occasional tips" }).click();
  await expect(section.getByRole("status")).toHaveText("Saved: occasional tips.");
  await expect(section.getByRole("button", { name: "Occasional tips" })).toHaveAttribute("aria-pressed", "true");
  await expect(section.getByText("At most one a day.")).toBeVisible();
  expect(puts).toEqual(["occasional"]);
  await section.scrollIntoViewIfNeeded();
  await section.screenshot({ path: "test-results/book-girl-setting.png" });
  const results = await new AxeBuilder({ page }).include("section[aria-labelledby='settings-bookgirl-heading']").analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("with reduced motion she holds still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/learning", (route) => route.fulfill({ json: { ok: true, data: { mode: "build", concepts: {} } } }));
  await gotoArea(page, "Settings");
  const svg = page.getByRole("region", { name: "Book Girl" }).locator("svg.bookgirl");
  await expect(svg).toBeVisible();
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && String((a as CSSAnimation).animationName ?? "").startsWith("bookgirl")).length);
  expect(running).toBe(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
