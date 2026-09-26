import { test, expect } from "./test";

/**
 * The Bridge — the home screen (contract worlds-briefing/1, slice 1b).
 *
 * Formerly overview.spec.ts. The home area kept its id ("overview")
 * but the screen it renders became the Bridge (owner plan
 * 2026-09-25), so the assertions moved with it: the main landmark is
 * named "Bridge", the map bodies are ACTIVATION BUTTONS sharing the
 * nav's state-driven path (never dead anchors), an item's area link
 * routes by state (never a URL nothing serves), and the Needs-you tray
 * caps at three while still counting the rest honestly.
 *
 * The mock API (scripts/e2e-api.mjs) answers the real contract:
 * arrivals, five have_tos (the cap), one not_configured system, one
 * unavailable system, and a person-authored thread.
 */

const NEWSSTAND = "Newsstand — Burrito Journalism — Not configured, 0 new, 0 need you";
const ARCHIVE = "Archive — Bruma — Healthy, 1 new, 1 need you";

test.describe("Bridge screen", () => {
  test.beforeEach(async ({ page }) => {
    // No fixture reset: /api/__test/reset is a SHARED server mutation and
    // the draft spec (serial, debounced) can be mid-save in another
    // worker. Nothing here depends on a null stored place — every panel
    // assertion follows an explicit click on the system it expects.
    await page.goto("/");
  });

  test("names the home landmark Bridge", async ({ page }) => {
    await expect(page.getByRole("main")).toHaveAttribute("aria-label", "Bridge");
    // Exactly one h1, and it is the screen's own name.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Bridge", level: 1 }),
    ).toBeAttached();
  });

  test("the star map's systems are spoke-aloud buttons, not URLs", async ({
    page,
  }) => {
    const map = page.getByRole("region", { name: "Star map" });
    await expect(map).toBeVisible();

    // Buttons, never dead anchors (the fake-URL trap this contract cut).
    expect(await map.getByRole("link").count()).toBe(0);
    await expect(map.getByRole("button", { name: ARCHIVE })).toBeVisible();

    // Tapping a body opens that system's briefing in the panel.
    await map.getByRole("button", { name: ARCHIVE }).click();
    const panel = page.getByRole("complementary", { name: "Briefing panel" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Archive" })).toBeVisible();
    await expect(panel).toContainText("Bruma");
  });

  test("a not_configured system speaks honestly — no fake items", async ({
    page,
  }) => {
    await page
      .getByRole("region", { name: "Star map" })
      .getByRole("button", { name: NEWSSTAND })
      .click();
    const panel = page.getByRole("complementary", { name: "Briefing panel" });
    await expect(panel).toContainText("Status: Not configured");
    await expect(panel).toContainText("No feed plugged in yet");
    await expect(panel).toContainText("Nothing to show here yet.");
  });

  test("Needs you caps at three and counts the rest quietly", async ({ page }) => {
    const tray = page.getByRole("region", { name: "Needs you" });
    await expect(tray).toBeVisible();
    expect(await tray.locator("li").count()).toBe(3);
    await expect(tray).toContainText("and 2 more, quietly waiting");
  });

  test("an item's area link routes by state, not a URL", async ({ page }) => {
    await page
      .getByRole("region", { name: "Star map" })
      .getByRole("button", { name: ARCHIVE })
      .click();
    const panel = page.getByRole("complementary", { name: "Briefing panel" });
    // Expand the item first — detail (and its doors) is disclosed, never
    // shouted (the calm-briefing rule).
    await panel
      .getByRole("button", { name: /A record wants a second look/ })
      .click();
    await panel.getByRole("button", { name: /Open Memory/ }).first().click();
    await expect(
      page.getByRole("heading", { name: "Memory", level: 1 }),
    ).toBeVisible();
  });

  test("the Keeper's line is text, and the artwork is decoration", async ({
    page,
  }) => {
    // The Keeper line is the ship's status line — real text, not art.
    await expect(
      page.getByText(/Two things need you, and the Workshop has been busy\./),
    ).toBeVisible();
    // Any keeper artwork is hidden from assistive tech (§7.3).
    const keeper = page.locator("[data-keeper-state]");
    if ((await keeper.count()) > 0) {
      await expect(keeper.first()).toHaveAttribute("aria-hidden", "true");
    }
  });

  test("loading and error states render honestly — never a blank screen", async ({
    page,
  }) => {
    await page.goto("/");
    const main = page.getByRole("main");
    await expect(main).toBeVisible();
    // Either the briefing arrived or the honest loading word is up. Wait
    // for one of them: a single instant can fall between the two.
    await expect(
      page
        .getByRole("region", { name: "Star map" })
        .or(page.getByText("Gathering your world…"))
        .first(),
    ).toBeVisible();
  });

  test("a failing briefing says so, with a retry", async ({ page }) => {
    await page.route("**/api/briefing", (route) =>
      route.fulfill({ status: 500, json: { detail: "station down" } }),
    );
    await page.goto("/");
    await expect(
      page.getByText("Couldn't reach your world right now."),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("the Bridge survives phone width without horizontal scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Star map" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});