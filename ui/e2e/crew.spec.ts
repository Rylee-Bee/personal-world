/**
 * The Crew page (owner 2026-09-26: its own page, linked from Settings).
 * Reached from Settings, full axe rule set with no suppressions, and one
 * real write round-trip against the fixture API: a keeper move shows up
 * in words on the page.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gotoArea } from "./helpers";

test.beforeEach(async ({ request }) => {
  await request.delete("/api/__test/reset");
});

async function openCrew(page: import("@playwright/test").Page) {
  await gotoArea(page, "Settings");
  await page.getByRole("button", { name: "Open your crew" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your crew" })).toBeVisible();
}

test("axe Crew: 0 serious/critical", async ({ page }) => {
  await openCrew(page);
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
});

test("Mira keeps Studio by default, and a keeper move lands in words", async ({ page }) => {
  await openCrew(page);
  const mira = page.getByRole("listitem", { name: "Mira" });
  await expect(mira.getByText("Keeps Studio")).toBeVisible();

  await page.getByRole("combobox", { name: "Studio" }).selectOption("renai");
  await expect(page.getByText("Renai now keeps Studio.")).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Renai" }).getByText(/Keeps Studio/)).toBeVisible();
  await expect(mira.getByText("No room · free to wander")).toBeVisible();
});

test("a new companion wears the commbadge until they have a picture", async ({ page }) => {
  await openCrew(page);
  await page.getByRole("textbox", { name: "Name" }).last().fill("Pip");
  await page.getByRole("button", { name: "Add to your crew" }).click();
  await expect(page.getByText("Pip is aboard.", { exact: false })).toBeVisible();
  const pip = page.getByRole("listitem", { name: "Pip" });
  await expect(pip.locator("img[src$='sol-badge.webp']")).toHaveCount(1);
});
