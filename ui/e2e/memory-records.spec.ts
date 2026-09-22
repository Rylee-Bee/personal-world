/**
 * Memory → Records — the structured-information door (C3 re-cut).
 *
 * Records is Memory's section; the Vault is not (contract: Records ≠
 * Vault). The real door this panel uses is GET /api/memory/search —
 * client-wrapped in src/data/api.ts (searchMemory) and served by
 * api.py's memory_search via the native provider; the e2e mock
 * answers with native_memory's exact envelope shape. These tests
 * prove: results are the world's own entries, refusals and empty
 * answers render honestly, and NOTHING is invented when the source
 * has nothing.
 */
import { test, expect, type Page } from "@playwright/test";

async function openRecords(page: Page) {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "World navigation" })
    .getByRole("button", { name: "Memory", exact: true })
    .click();
  const records = page.getByRole("region", { name: "Records" });
  await expect(records).toBeVisible();
  return records;
}

test.describe("Records (inside Memory)", () => {
  test("the Records-vs-Vault distinction is stated where a person reads it", async ({
    page,
  }) => {
    const records = await openRecords(page);
    await expect(
      records.getByText(/Records are not the Vault/i),
    ).toBeVisible();
  });

  test("a search returns the world's own stored lines — real endpoint, real data", async ({
    page,
  }) => {
    const records = await openRecords(page);
    // "vault" appears in a fixture journal entry ("Reviewed the vault
    // encryption approach…"); the hit must come from the API, not a
    // rendered constant.
    await page.request.delete("http://127.0.0.1:4174/api/journal/draft");
    await records.getByLabel("Search records").fill("vault encryption");
    await records.getByRole("button", { name: "Search the memory source" }).click();

    const results = page.getByRole("region", { name: "Record results" });
    await expect(
      results.getByText("Reviewed the vault encryption approach"),
    ).toBeVisible();
    // each hit carries its source kind + a machine-time timestamp
    await expect(results.locator("time[datetime]")).toHaveCount(1);
  });

  test("a search that matches nothing says so — no padded results", async ({
    page,
  }) => {
    const records = await openRecords(page);
    await records.getByLabel("Search records").fill("zzz-not-a-real-record");
    await records.getByRole("button", { name: "Search the memory source" }).click();
    await expect(
      records.getByText(/Nothing stored matches/),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Record results" })).toHaveCount(
      0,
    );
  });

  test("when the memory source refuses, the refusal is shown, not softened", async ({
    page,
  }) => {
    await page.route("**/api/memory/search**", (route) =>
      route.fulfill({
        json: {
          ok: false,
          status: "unavailable",
          warnings: ["no memory provider"],
        },
      }),
    );
    const records = await openRecords(page);
    await records.getByLabel("Search records").fill("anything");
    await records.getByRole("button", { name: "Search the memory source" }).click();
    await expect(records.getByText("no memory provider")).toBeVisible();
    await expect(page.getByRole("region", { name: "Record results" })).toHaveCount(
      0,
    );
  });
});
