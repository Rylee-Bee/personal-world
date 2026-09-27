import { test, expect } from "./test";

/**
 * UAT 2026-09-27: at 390px wide, Settings sat under the Remember button and
 * a tap did nothing (so Rough night was out of reach on a phone): it was
 * past the edge of a sideways scroller with no hint. Every world-nav button
 * must be on screen as the page opens, and be what a tap at its centre hits.
 */
test.use({ viewport: { width: 390, height: 844 } });

test("every navigation button can be tapped on a phone", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "World navigation" });
  await expect(nav.getByRole("button").first()).toBeVisible();
  const covered = await nav.getByRole("button").evaluateAll((buttons) =>
    buttons
      .map((b) => {
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit && (hit === b || b.contains(hit)) ? null : (b.textContent ?? "").trim();
      })
      .filter((x) => x !== null),
  );
  expect(covered).toEqual([]);
  await nav.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
});
