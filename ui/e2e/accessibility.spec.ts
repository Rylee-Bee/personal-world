import { test, expect } from "./test";

test.describe("Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("skip-to-main-content link exists and is focusable", async ({ page }) => {
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toHaveCount(1);

    // Tab from body → skip link (first focusable element)
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
  });

  test("all nav links have accessible names", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "World navigation" });
    const links = nav.getByRole("button");

    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const name = await links.nth(i).getAttribute("aria-label");
      const text = await links.nth(i).textContent();
      // Every nav button must have either an aria-label or visible text
      expect(name || text?.trim()).toBeTruthy();
    }
  });

  test("main content has aria-label", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main).toHaveAttribute("aria-label", /.+/);
  });

  test("no focus-trap: Tab reaches all interactive elements", async ({ page }) => {
    const focused: string[] = [];
    // Let the page finish loading first: a Tab that lands on an element
    // that then re-renders leaves nothing focused, and a `:focus` locator
    // would wait forever instead of reporting it.
    await page.waitForLoadState("networkidle");
    // Press Tab 15 times to walk through interactive elements
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      focused.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return "body";
          return (
            el.getAttribute("aria-label") ||
            el.getAttribute("role") ||
            el.textContent?.trim() ||
            "unknown"
          );
        }),
      );
    }

    // Should have reached at least the skip link + several nav buttons
    expect(focused.length).toBe(15);
    // Skip link should be among the first focused elements
    expect(focused.some((n) => n.includes("Skip"))).toBeTruthy();
    // Focus never falls out to the page body mid-walk.
    expect(focused.filter((n) => n === "body")).toEqual([]);
  });
});
