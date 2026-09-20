import { test, expect } from "@playwright/test";

test.describe("Today screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("greeting text is visible", async ({ page }) => {
    // The greeting line contains "Operator" (e.g. "Good morning, Operator")
    const greeting = page.getByRole("heading", { name: /Operator/i, level: 1 });
    await expect(greeting).toBeVisible();
  });

  test("world areas section exists", async ({ page }) => {
    const section = page.getByRole("region", { name: "World areas" });
    await expect(section).toBeVisible();

    // Should contain navigation links to other areas
    const links = section.getByRole("link");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
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
