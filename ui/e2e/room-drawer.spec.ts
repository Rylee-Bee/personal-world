/**
 * The room drawer (Spec-Drawer): opened from a doorway, a labelled
 * non-modal dialog; full axe rule set with no suppressions; Escape
 * closes it and focus returns to the doorway's Look inside button.
 */
import { test, expect } from "./test";
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

test("the Workshop's drawer shows secrets by name, passes axe, and fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Look inside Workshop" }).click();
  const drawer = page.getByRole("dialog", { name: "Workshop" });
  await expect(drawer.getByRole("heading", { name: "Secrets" })).toBeVisible();
  await expect(drawer.getByText("Connected")).toBeVisible();
  await expect(
    drawer.getByRole("link", { name: "Enter mail/relay-password in Project Home, in a new tab" }),
  ).toHaveAttribute("href", "https://room.test/secrets?request=req-1");
  // Names only: there is nowhere in Worlds to type a value.
  await expect(drawer.locator("input")).toHaveCount(0);
  await drawer.getByRole("button", { name: /^▸?\s*mail/ }).click();
  await expect(drawer.getByText("mail/relay-password").last()).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await drawer.screenshot({ path: "test-results/secrets-drawer.png" });
});

test("approving from the Workshop's drawer: Not now first, Approved only from the receipt", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let decided = false;
  const keys: string[] = [];
  await page.route("**/api/rooms", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const row of body.data ?? []) {
      if (row.id === "workshop" && !decided) {
        row.needs_you = [
          {
            id: "approval:a1",
            title: "Bolt's icon changes",
            why: "6 files in the icon library.",
            actions: ["approve", "decline"],
            created_at: "2026-09-25T09:00:00Z",
          },
        ];
      }
    }
    await route.fulfill({ response, json: body });
  });
  await page.route("**/api/rooms/workshop/actions/approve", async (route) => {
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    expect(route.request().postDataJSON()).toEqual({ approval_id: "a1" });
    decided = true;
    await route.fulfill({
      json: {
        ok: true,
        data: { action_id: "approve", ok: true, summary: "Approved: Bolt's icon changes.", changed: [], at: "2026-09-25T19:44:00Z" },
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Look inside Workshop" }).click();
  const drawer = page.getByRole("dialog", { name: "Workshop" });
  await drawer.getByRole("button", { name: "Approve or decline “Bolt's icon changes”" }).click();
  await expect(drawer.getByRole("button", { name: "Not now" })).toBeFocused();

  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

  await drawer.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(drawer.getByText("Approved", { exact: true })).toBeFocused();
  await expect(drawer.getByText("Approved: Bolt's icon changes.")).toBeVisible();
  expect(keys).toHaveLength(1);
  expect(keys[0]).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
  // The approval refreshes the rooms; let that refetch go quietly.
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
