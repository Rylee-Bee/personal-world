/**
 * Rough night — the calmest screen, proven in the browser.
 *
 * Two promises this page makes and the rest of the app does not:
 *   1. NOTHING moves. Not one element inside the page animates or
 *      transitions, whatever theme or motion pref the person's device
 *      carries — the page itself ships no motion, and the assertion
 *      reads the computed styles of every element in the region.
 *   2. It fits a phone one-handed: no horizontal scroll at 390px.
 * Plus the one honest write: picking a level and saving lands the
 * journal line through the mock API and says so in a status.
 */
import { type Page } from "@playwright/test";
import { test, expect } from "./test";

async function openRoughNight(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Rough night?" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Rough night" }),
  ).toBeVisible();
}

test("nothing on the page animates or transitions", async ({ page }) => {
  await openRoughNight(page);
  const offenders = await page.evaluate(() => {
    const root = document.getElementById("main-content");
    if (!root) return ["#main-content is missing"];
    const still = (value: string) =>
      value.split(",").every((part) => Number.parseFloat(part) === 0);
    const bad: string[] = [];
    for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) {
      const cs = getComputedStyle(el);
      const animates = cs.animationName !== "none" && !still(cs.animationDuration);
      const transitions =
        cs.transitionProperty !== "none" && !still(cs.transitionDuration);
      if (animates || transitions) {
        bad.push(`${el.tagName.toLowerCase()}.${String(el.className)}`);
      }
    }
    return bad;
  });
  expect(offenders).toEqual([]);
});

test("no horizontal scroll at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoughNight(page);
  const width = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(width.scrollWidth).toBeLessThanOrEqual(width.clientWidth);
});

test("choosing a level saves the line and says so", async ({ page }) => {
  await openRoughNight(page);
  const save = page.getByRole("button", { name: "Save for my doctor" });
  await expect(save).toBeDisabled();
  const bad = page.getByRole("button", { name: "3 · Bad" });
  await bad.click();
  await expect(bad).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "5 · The worst" }),
  ).toHaveAttribute("aria-pressed", "false");
  await page
    .getByRole("textbox", { name: "Anything else? (optional)" })
    .fill("hard pain night");
  await save.click();
  await expect(
    page.getByRole("main", { name: "Rough night" }).getByRole("status"),
  ).toContainText("Saved to your journal.");
  // Back returns to the Bridge.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Rough night?" }),
  ).toBeVisible();
});
