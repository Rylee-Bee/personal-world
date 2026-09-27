/**
 * Fixes from the owner's first-day walk-through (2026-09-27):
 * - Interests with nothing followed: a calm empty state with a way in, and
 *   every check says what it found ("Checked just now: …").
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

test("Interests: nothing followed shows a way in, and a check always answers", async ({ page }) => {
  const empty = { sources: [], interests: [], items: [], source_count: 0, interest_count: 0, item_count: 0 };
  let followed: string | null = null;
  await page.route("**/api/discovery/status", (route) =>
    route.fulfill({ json: { ok: true, status: "healthy", data: empty, warnings: [] } }),
  );
  await page.route("**/api/discovery/discover*", (route) =>
    route.fulfill({ json: { ok: true, status: "healthy", data: { items: [], count: 0, sources_queried: 0 }, warnings: [] } }),
  );
  await page.route("**/api/discovery/interests", (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    followed = route.request().postDataJSON().name;
    return route.fulfill({ json: { ok: true, data: { id: "kilns", name: followed } } });
  });
  await gotoArea(page, "Interests");
  const main = page.getByRole("main", { name: "Interests" });
  await expect(main.getByText(/Nothing to look through yet\. Add something you’re curious about/)).toBeVisible();
  await main.getByRole("button", { name: "Check sources now" }).click();
  await expect(main.getByText("Checked just now: nothing to look through yet.")).toBeVisible();
  await main.getByLabel("What are you curious about?").fill("Kilns");
  await main.getByRole("button", { name: "Follow it" }).click();
  await expect(main.getByText("Following “Kilns”. The next check looks for it.")).toBeVisible();
  expect(followed).toBe("Kilns");
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  await page.unrouteAll({ behavior: "ignoreErrors" });
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
