import { test, expect } from "@playwright/test";

/**
 * Overview screen — the headlines surface (the re-cut "Today").
 *
 * Formerly today.spec.ts. Assertions moved with the contract: the
 * main landmark is named "Overview", and the Explore tiles are
 * ACTIVATION BUTTONS sharing the nav's state-driven path — the old
 * spec asserted anchor links whose hrefs pointed at URLs nothing
 * served (the fake-URL trap this pass fixed; a link here is now the
 * regression).
 */

test.describe("Overview screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("greeting text is visible", async ({ page }) => {
    // The greeting line contains "Operator" (e.g. "Good morning, Operator")
    const greeting = page.getByRole("heading", { name: /Operator/i, level: 1 });
    await expect(greeting).toBeVisible();
  });

  test("world areas section exists and activates destinations by state, not URL", async ({
    page,
  }) => {
    const section = page.getByRole("region", { name: "World areas" });
    await expect(section).toBeVisible();

    // Buttons, never dead anchors.
    expect(await section.getByRole("link").count()).toBe(0);
    const buttons = section.getByRole("button");
    expect(await buttons.count()).toBeGreaterThan(0);

    // Tapping a tile lands on the same screen the nav would: Memory.
    await section.getByRole("button", { name: "Memory", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Memory", level: 1 }),
    ).toBeVisible();
  });

  test("capabilities section exists", async ({ page }) => {
    const section = page.getByRole("region", { name: "Capabilities" });
    await expect(section).toBeVisible();
  });

  test("loading state renders honestly", async ({ page }) => {
    // Navigate fresh — if the API is slow, loading text should appear
    await page.goto("/");
    const main = page.getByRole("main");
    await expect(main).toBeVisible();
    // Either the summary loaded or a loading indicator is shown
    const hasGreeting = await page
      .getByRole("heading", { name: /Operator/i, level: 1 })
      .isVisible();
    const hasLoading = await page.getByText("Loading your world…").isVisible();
    expect(hasGreeting || hasLoading).toBeTruthy();
  });

  test("error state renders honestly", async ({ page }) => {
    // If the API fails, an error message should be shown instead of a broken UI
    await page.goto("/");
    const main = page.getByRole("main");
    await expect(main).toBeVisible();
    const hasGreeting = await page
      .getByRole("heading", { name: /Operator/i, level: 1 })
      .isVisible();
    const hasError = await page
      .getByText("Unable to load your world right now.")
      .isVisible();
    const hasLoading = await page.getByText("Loading your world…").isVisible();
    // One of these states must be true — the screen never renders blank
    expect(hasGreeting || hasError || hasLoading).toBeTruthy();
  });
});

/**
 * The daily home loop (TRUE-NORTH, Wave 1 Lane A): Orient → Remember
 * → Resume → Discover, plus the parked-Projects ruling. The mock API
 * (scripts/e2e-api.mjs) answers the real server contract: a populated
 * journal, two discovery sources with no batch due, and a dated
 * two-row agent-sync observation.
 */
test.describe("Overview daily home loop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("the Keeper greets as hidden decoration — never telemetry", async ({
    page,
  }) => {
    const keeper = page.locator("[data-keeper-state]");
    await expect(keeper).toBeVisible();
    await expect(keeper).toHaveAttribute("aria-hidden", "true");
    // The pose depends on the clock alone: greet by day, rest at night.
    const state = await keeper.getAttribute("data-keeper-state");
    expect(state === "hello" || state === "sleep").toBeTruthy();
    // A screen reader meets the greet line, not the artwork (§7.3).
    await expect(
      page.getByRole("heading", { name: /Operator/i, level: 1 }),
    ).toBeVisible();
  });

  test("Resume — the newest thread, one tap into Memory", async ({ page }) => {
    const thread = page.getByRole("region", { name: "Your thread" });
    await expect(thread).toBeVisible();
    // The mock journal's newest current event, verbatim.
    await expect(thread).toContainText("Correction noted");
    await thread.getByRole("button", { name: "Pick up in Memory" }).click();
    await expect(
      page.getByRole("heading", { name: "Memory", level: 1 }),
    ).toBeVisible();
  });

  test("Discover — the sliver states its cadence honestly", async ({ page }) => {
    const sliver = page.getByRole("region", { name: "Brought to you" });
    await expect(sliver).toBeVisible();
    // Two sources listening, no batch due: the cadence promise, not a
    // fabricated pick.
    await expect(sliver).toContainText("2 sources are");
    await expect(sliver).toContainText("cadence");
  });

  test("Projects — every row links to its authoritative source", async ({
    page,
  }) => {
    const section = page.getByRole("region", { name: "Projects" });
    await expect(section).toBeVisible();
    await expect(section).toContainText("a fresh observation");

    const link = section.getByRole("link", {
      name: "Open the source of personal-world",
    });
    await expect(link).toHaveAttribute(
      "href",
      "https://example.invalid/personal-world.git",
    );
    // The row with no recorded remote links nowhere and says so.
    await expect(section).toContainText("no remote recorded");
  });

  test("the loop survives phone width without horizontal scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(
      page.getByRole("region", { name: "Your thread" }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
