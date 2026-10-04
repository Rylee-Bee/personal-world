/**
 * Fixes from the owner's first-day walk-through (2026-09-27):
 * - A system that isn't set up goes to where it's set up; Newsstand, which
 *   can't be set up yet, says so plainly.
 * - Choosing a companion is one tap, not three levels down.
 */
import { test, expect } from "./test";
import AxeBuilder from "@axe-core/playwright";
import { gotoArea } from "./helpers";

test.beforeEach(async ({ request }) => {
  await request.delete("/api/__test/reset");
});

test("Bridge: Newsstand says plainly it can't be set up yet", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Newsstand/ }).first().click();
  const panel = page.getByRole("complementary", { name: "Briefing panel" });
  await expect(panel.getByText(/Newsstand can’t be set up yet\. News is moving to the Candy room/)).toBeVisible();
});

test("Your crew: choose a companion in one tap, and it says so", async ({ page }) => {
  // The fixture's prefs vocabulary predates companion_id; the real server
  // takes a crew id (or null). Stand in for that one write.
  let companion: string | null = null;
  await page.route("**/api/prefs", async (route) => {
    const req = route.request();
    if (req.method() === "PUT") {
      companion = req.postDataJSON().companion_id ?? null;
      return route.fulfill({ json: { ok: true, status: "healthy", data: { companion_id: companion } } });
    }
    const response = await route.fetch();
    const body = await response.json();
    body.data = { ...body.data, companion_id: companion };
    return route.fulfill({ response, json: body });
  });
  await gotoArea(page, "Settings");
  await page.getByRole("button", { name: "Open your crew" }).click();
  await page.getByRole("button", { name: "Choose your companion" }).click();
  const drawer = page.getByRole("dialog", { name: "Choose your companion" });
  await expect(drawer.getByRole("button", { name: /^Assistant/ })).toHaveAttribute("aria-pressed", "true");
  const other = drawer.locator("li button[aria-pressed=\"false\"]").first();
  const name = ((await other.locator("span.font-semibold").first().textContent()) ?? "").trim();
  await other.click();
  await expect(drawer.getByRole("status")).toHaveText(`${name} is your companion now.`);
  await expect(drawer.getByRole("button", { name: new RegExp(`^${name}`) })).toHaveAttribute("aria-pressed", "true");
  expect(companion).not.toBeNull();
  await page.screenshot({ path: "test-results/companion-chooser-1440.png" });
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
