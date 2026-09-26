/**
 * The Crew page (owner 2026-09-26: its own page, linked from Settings).
 * Reached from Settings, full axe rule set with no suppressions, and one
 * real write round-trip against the fixture API: a keeper move shows up
 * in words on the page.
 */
import { test, expect } from "./test";
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

test("Studio has no keeper until you pick one, and a keeper move lands in words", async ({ page }) => {
  await openCrew(page);
  const mira = page.getByRole("listitem", { name: "Mira" });
  await expect(mira.getByText("No room · free to wander")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Keeper for Studio" })).toHaveValue("");

  await page.getByRole("combobox", { name: "Keeper for Studio" }).selectOption("mira");
  await expect(page.getByText("Mira now keeps Studio.")).toBeVisible();
  await expect(mira.getByText(/Keeps Studio/)).toBeVisible();
});

test("a doorway choice is kept by the station, and can be cleared", async ({ page, request }) => {
  await openCrew(page);
  const door = page.getByRole("combobox", { name: "Doorway for Studio" });
  await expect(door).toHaveValue("");
  await door.selectOption("study");
  await expect(door).toHaveValue("study");
  const rows = (await (await request.get("/api/rooms")).json()).data as Array<{ id: string; doorway: string | null }>;
  expect(rows.find((r) => r.id === "studio")?.doorway).toBe("study");
  await door.selectOption("");
  await expect(door).toHaveValue("");
});

test("a new companion wears the commbadge until they have a picture", async ({ page }) => {
  await openCrew(page);
  await page.getByRole("textbox", { name: "Name" }).last().fill("Pip");
  await page.getByRole("button", { name: "Add to your crew" }).click();
  await expect(page.getByText("Pip is aboard.", { exact: false })).toBeVisible();
  const pip = page.getByRole("listitem", { name: "Pip" });
  await expect(pip.locator("img[src$='sol-badge.webp']")).toHaveCount(1);
});
