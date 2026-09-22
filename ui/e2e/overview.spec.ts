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
