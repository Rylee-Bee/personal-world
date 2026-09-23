/**
 * Memory — the deterministic PLACE (TRUE-NORTH G-memory: "layout
 * stable"; PRODUCT-LANGUAGE §Memory: "open instantly, with every model
 * turned off · predictable structure and preserve layout").
 *
 * The gate these tests hold: the Memory screen shows the SAME
 * landmarks in the SAME order on every visit — under a seeded station,
 * a degraded records source, an empty journal, and a phone-width
 * reflow. Data may come and go; the place never moves. (Nav-level
 * landmark stability lives in landmark-stability.spec.ts; this spec
 * owns the inside of the Memory screen.)
 */
import { test, expect, type Page } from "@playwright/test";

const LANDMARKS = ["Memory", "Journal", "Records"];

async function gotoMemory(page: Page) {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "World navigation" })
    .getByRole("button", { name: "Memory", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Memory", level: 1 }),
  ).toBeVisible();
}

/** The screen's VISIBLE heading landmarks in DOM order (h1 → h2s).
 * JournalRoom keeps its two drawer headings mounted-but-hidden inside
 * <main> (native dialog semantics); the layout contract is about what
 * a person sees, so hidden headings are filtered, not counted. */
function landmarkOrder(page: Page): Promise<string[]> {
  return page.$$eval("main h1, main h2", (hs) =>
    hs
      .filter((h) => h.checkVisibility())
      .map((h) => (h.textContent ?? "").trim()),
  );
}

/** The two fixed fixtures of the place: the journal write form and the
 * search door — present in EVERY data state, never conditional. */
async function expectFixedFixtures(page: Page) {
  await expect(page.getByLabel("New entry")).toBeVisible();
  await expect(page.getByLabel("Search records")).toBeVisible();
}

test.describe("Memory layout is deterministic (G-memory)", () => {
  test("the same landmarks sit in the same order on repeated visits", async ({
    page,
  }) => {
    await gotoMemory(page);
    expect(await landmarkOrder(page)).toEqual(LANDMARKS);
    await expectFixedFixtures(page);

    // Leave for Overview, come back — the place did not move.
    await page
      .getByRole("navigation", { name: "World navigation" })
      .getByRole("button", { name: "Overview", exact: true })
      .click();
    await gotoMemory(page);
    expect(await landmarkOrder(page)).toEqual(LANDMARKS);
    await expectFixedFixtures(page);

    // And a full reload + re-entry answers identically.
    await gotoMemory(page);
    expect(await landmarkOrder(page)).toEqual(LANDMARKS);
    await expectFixedFixtures(page);
  });

  test("landmarks hold when the records source is degraded", async ({
    page,
  }) => {
    const unavailable = {
      ok: false,
      status: "unavailable",
      warnings: ["no memory provider"],
    };
    await page.route(
      (url) => url.pathname.startsWith("/api/records"),
      (route) => route.fulfill({ json: unavailable }),
    );
    await gotoMemory(page);
    expect(await landmarkOrder(page)).toEqual(LANDMARKS);
    await expectFixedFixtures(page);
    // the honest degradation states itself inside the same stable frame
    await expect(page.getByText(/No source yet for records/)).toBeVisible();
  });

  test("landmarks hold when the journal is empty", async ({
    page,
  }) => {
    await page.route(
      (url) => url.pathname === "/api/journal",
      (route) => route.fulfill({ json: { ok: true, data: [] } }),
    );
    await gotoMemory(page);
    expect(await landmarkOrder(page)).toEqual(LANDMARKS);
    await expectFixedFixtures(page);
    await expect(
      page.getByText(/No journal entries yet/),
    ).toBeVisible();
  });

  test("phone-width reflow keeps the order and never scrolls sideways", async ({
    page,
  }) => {
    // Accessibility contract §6.4: layout survives reflow without
    // horizontal page scroll — at a narrow phone width, same landmarks.
    await page.setViewportSize({ width: 360, height: 640 });
    await gotoMemory(page);
    expect(await landmarkOrder(page)).toEqual(LANDMARKS);
    await expectFixedFixtures(page);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
