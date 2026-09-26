import { type Page } from "@playwright/test";
import { test, expect } from "./test";
import { gotoArea } from "./helpers";
import AxeBuilder from "@axe-core/playwright";

/**
 * The Notifications section in Settings (Web Push; docs/
 * NOTIFICATIONS.md) against the deterministic mock station.
 *
 * The parts that need a real push service (subscribing this device,
 * which also rides the browser's permission prompt) are NOT exercised
 * here — the unit tests (src/test/notifications.test.tsx) cover that
 * logic against mocked browser glue. What e2e proves is the product
 * contract: the section speaks in words, the prefs round-trip through
 * the server and survive a reload, and nothing here ever shows a
 * credential or a push endpoint.
 */

async function gotoNotifications(page: Page) {
  await gotoArea(page, "Settings");
  await expect(
    page.getByRole("region", { name: "Notifications", exact: true }),
  ).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.describe("Settings: notifications", () => {
  test.beforeEach(async ({ request }) => {
    await request.delete("/api/__test/reset");
  });

  test("leads with a plain-words state, never a bare checkbox", async ({
    page,
  }) => {
    await gotoNotifications(page);
    // Headless Chromium's notification permission is environment-dependent,
    // so the honest sentence is allowed to be any of the real states —
    // what must never appear is no sentence at all.
    await expect(
      page.getByText(/Notifications are (on|off|not configured|blocked)/),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Devices" })).toBeVisible();
    await expect(page.getByText("No devices yet.")).toBeVisible();
  });

  test("tier toggles round-trip through the server and survive a reload", async ({
    page,
  }) => {
    await gotoNotifications(page);
    const whenReady = page.getByLabel(/When you're ready/);
    await expect(whenReady).toBeChecked({ checked: false }); // quiet by default
    await whenReady.check();
    await expect(whenReady).toBeChecked();
    await page.reload();
    await gotoNotifications(page);
    await expect(page.getByLabel(/When you're ready/)).toBeChecked();
  });

  test("quiet hours can be turned off and back on", async ({ page }) => {
    await gotoNotifications(page);
    const quiet = page.getByLabel("Keep the night quiet");
    await expect(quiet).toBeChecked(); // the default is a quiet night
    await quiet.uncheck();
    await page.reload();
    await gotoNotifications(page);
    await expect(page.getByLabel("Keep the night quiet")).toBeChecked({ checked: false });
  });

  test("the section passes axe, fits a phone, and shows the history", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoNotifications(page);
    const section = page.getByRole("region", { name: "Notifications", exact: true });
    await expect(section.getByText("The tomatoes ripened")).toBeVisible();
    await expect(section.getByRole("switch", { name: /A small update/ })).not.toBeChecked();
    await section.screenshot({ path: "test-results/notifications-390.png" });
    const results = await new AxeBuilder({ page }).include("#settings-notifications-heading").analyze();
    const all = await new AxeBuilder({ page }).analyze();
    const bad = [...results.violations, ...all.violations].filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });

  test("Send me a test answers honestly when no device is listening", async ({
    page,
  }) => {
    await gotoNotifications(page);
    await page.getByRole("button", { name: "Send me a test" }).click();
    await expect(
      page.getByText(/in your history, but no device is turned on yet, so nothing buzzed/),
    ).toBeVisible();
  });
});
