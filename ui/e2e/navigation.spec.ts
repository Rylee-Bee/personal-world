import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads Today screen by default", async ({ page }) => {
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Today", level: 1 }),
    ).toBeVisible();
  });

  test("click Journal nav link shows Journal screen", async ({ page }) => {
    await page.getByRole("button", { name: "Journal" }).click();
    await expect(page.getByRole("heading", { name: "Journal", level: 1 })).toBeVisible();
  });

  test("click Vault nav link shows Vault screen", async ({ page }) => {
    await page.getByRole("button", { name: "Records" }).click();
    await expect(page.getByRole("heading", { name: "Vault", level: 1 })).toBeVisible();
  });

  test("click Settings nav link shows Settings screen", async ({ page }) => {
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  });

  test("click News nav link shows Chat screen", async ({ page }) => {
    await page.getByRole("button", { name: "News" }).click();
    await expect(page.getByRole("heading", { name: "Chat", level: 1 })).toBeVisible();
  });

  test("click Today nav link returns to Today screen", async ({ page }) => {
    await page.getByRole("button", { name: "Journal" }).click();
    await expect(page.getByRole("heading", { name: "Journal", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "Today" }).click();
    await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  });
});
