import { test, expect } from "@playwright/test";
import { gotoArea, navButtonLabels } from "./helpers";

/**
 * Navigation — the stable skeleton contract (PRODUCT-LANGUAGE.md).
 *
 * The old spec pinned the pre-contract nav (Today/Systems/…/Records/
 * News). The contract re-cut it: four fixed landmarks first
 * (Overview · Memory · Chat · Settings), personal sections behind.
 * Coverage moved forward with the contract — nothing was deleted,
 * every old assertion has a new-contract counterpart here or in
 * landmark-stability.spec.ts / vault-in-settings.spec.ts.
 */

const LANDMARKS = ["Overview", "Memory", "Chat", "Settings"] as const;

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads Overview by default", async ({ page }) => {
    await expect(page.getByRole("main")).toBeVisible();
    // Product truth: the Overview screen OPENS with the greeting —
    // "Good morning, Operator" is the h1. "Overview" remains as the
    // main landmark's accessible name.
    await expect(
      page.getByRole("heading", { name: /Operator/i, level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("main")).toHaveAttribute(
      "aria-label",
      "Overview",
    );
  });

  test("the four landmarks render first, in contract order", async ({ page }) => {
    // poll, not one snapshot: /api/sections can settle mid-read and
    // change the tail of the bar (never its first four).
    await expect
      .poll(async () => (await navButtonLabels(page)).slice(0, 4))
      .toEqual([...LANDMARKS]);
  });

  test("active landmark carries aria-current", async ({ page }) => {
    await expect(
      page
        .getByRole("navigation", { name: "World navigation" })
        .getByRole("button", { name: "Overview", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("nav labels are state-routed buttons, not URLs nothing serves", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", { name: "World navigation" });
    expect(await nav.getByRole("link").count()).toBe(0);
    expect(await nav.getByRole("button").count()).toBeGreaterThanOrEqual(4);
  });
});

test.describe("Navigation — destinations", () => {
  test("Memory holds the journal spine and the Records section", async ({
    page,
  }) => {
    await gotoArea(page, "Memory");
    await expect(
      page.getByRole("heading", { name: "Memory", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("main")).toHaveAttribute("aria-label", "Memory");
    await expect(
      page.getByRole("heading", { name: "Journal", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Records", level: 2 }),
    ).toBeVisible();
  });

  test("Chat opens the Chat screen (the old 'News' label is retired)", async ({
    page,
  }) => {
    await gotoArea(page, "Chat");
    await expect(
      page.getByRole("heading", { name: "Chat", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("main")).toHaveAttribute("aria-label", "Chat");
  });

  test("Settings opens Settings — and hosts the relocated Vault tool", async ({
    page,
  }) => {
    await gotoArea(page, "Settings");
    await expect(
      page.getByRole("heading", { name: "Settings", level: 1 }),
    ).toBeVisible();
    // exact: the Vault tool also contains a "Vault status" region —
    // substring matching would resolve to both.
    await expect(
      page.getByRole("region", { name: "Vault", exact: true }),
    ).toBeVisible();
  });

  test("Interests opens as a personal section after the landmarks", async ({
    page,
  }) => {
    await gotoArea(page, "Interests");
    await expect(
      page.getByRole("heading", { name: "Interests", level: 1 }),
    ).toBeVisible();
  });

  test("the retired nav words are gone from the bar", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "World navigation" });
    for (const retired of [
      "Today",
      "Journal",
      "Records",
      "News",
      "Vault",
      "Systems",
    ]) {
      await expect(
        nav.getByRole("button", { name: retired, exact: true }),
      ).toHaveCount(0);
    }
  });
});
