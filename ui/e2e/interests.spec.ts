import { test, expect, type Page } from "@playwright/test";
import { expectKeyboardFocusRing } from "./helpers";

/**
 * C3/C4 Interests view — e2e proof on the deterministic mock station.
 * The engine check must never fire on page load (only a discovery
 * STATUS read happens there), finds carry a real provenance line, and
 * the composed focus ring lands on every new control (C7).
 */

async function gotoInterests(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Interests" }).click();
  await expect(
    page.getByRole("heading", { name: "Interests", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Engine finds" }),
  ).toBeVisible();
}

test.describe("Interests (C3/C4)", () => {
  test("opening the view asks the discovery engine NOTHING — the check is user-initiated", async ({
    page,
  }) => {
    const discoverCalls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/discovery/discover")) {
        discoverCalls.push(req.url());
      }
    });

    await gotoInterests(page);
    expect(discoverCalls, "no silent engine run on load (a11y §8.2)").toHaveLength(0);
    await expect(
      page.getByText(/No check run since you opened this view\./),
    ).toBeVisible();

    await page.getByRole("button", { name: "Check sources now" }).click();
    await expect(page.getByText("Check finished — 1 new find.")).toBeVisible();
    expect(discoverCalls).toHaveLength(1);
  });

  test("each find carries where + when + capture-mode provenance", async ({
    page,
  }) => {
    await gotoInterests(page);
    await page.getByRole("button", { name: "Check sources now" }).click();

    const card = page.getByRole("heading", { name: /Project Worlds v1\.4\.0/ });
    await expect(card).toBeVisible();

    const provenance = page.locator("li p", { hasText: "From" }).first();
    await expect(provenance).toContainText("Project Worlds releases");
    await expect(provenance).toContainText("candy-dispenser discovery (vendored)");
    await expect(provenance).toContainText("github_releases");
    // the timestamp is a real <time> element with a machine datetime
    await expect(page.locator("time[datetime='2026-09-20T08:55:00+00:00']")).toHaveCount(1);
    await expect(
      page.getByText(/Captured by the engine into this world's own check window — nothing was pushed anywhere\./),
    ).toBeVisible();

    // Followed-interests list is present and honestly read-only.
    await expect(
      page.getByRole("region", { name: "What you follow" }),
    ).toContainText("self-hosting");
    await expect(page.locator("#main-content")).toBeVisible();
  });

  test("source roster states which sources are on and off in words", async ({
    page,
  }) => {
    await gotoInterests(page);
    await expect(
      page.getByText(/Sources on this station:.*\(on\).*\(off\)/),
    ).toBeVisible();
  });

  test("new controls show the composed focus ring when reached by Tab (C7)", async ({
    page,
  }) => {
    await gotoInterests(page);
    await expectKeyboardFocusRing(
      page,
      page.getByRole("button", { name: "Check sources now" }),
      "Interests check button",
    );

    // After a check, the finding's external link — reached by Tab.
    await page.getByRole("button", { name: "Check sources now" }).click();
    await expect(page.getByText("Check finished — 1 new find.")).toBeVisible();
    await expectKeyboardFocusRing(
      page,
      page.getByRole("link", { name: /Project Worlds v1\.4\.0/ }),
      "Finding external link",
    );
  });
});
