import { test, expect, type Page } from "@playwright/test";

/**
 * C8 reduced-motion pass on the Track C panels (Settings Room,
 * Interests). The assertion is comparative on purpose: the SAME
 * control under the SAME build must compute motionless styles when
 * the OS preference is "reduce" and may keep its colour-only
 * transitions otherwise — a test that asserted "0s" unconditionally
 * would pass even if the media query never fired.
 *
 * Floor sources: ui/src/styles/world.css §6.2 block (OS override,
 * unconditional) and motion-reduce:transition-none on components;
 * prefs.py documents that OS prefers-reduced-motion always wins.
 */

async function gotoSettings(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(
    page.getByRole("region", { name: "Reading & Interaction" }),
  ).toBeVisible();
}

async function gotoInterests(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Interests" }).click();
  await expect(
    page.getByRole("region", { name: "Engine finds" }),
  ).toBeVisible();
}

function motionOf(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      transitionDuration: cs.transitionDuration,
      animationName: cs.animationName,
      animationDuration: cs.animationDuration,
    };
  });
}

// Chrome reports 0.01ms (the §6.2 override) as "1e-05s" computed.
const MOTIONLESS = /(^|[, ])(0s|0\.0?1m?s|1e-05s)([, ]|$)/;

test.describe("reduced motion (C8) — OS preference reduce", () => {
  test.use({ reducedMotion: "reduce" });

  test("Settings Room controls are motionless under prefers-reduced-motion", async ({
    page,
  }) => {
    await gotoSettings(page);
    for (const sel of [
      "#settings-room-motion-control",
      "#settings-room-contrast-control",
      "button:has-text('Apply changes')",
    ]) {
      const m = await motionOf(page, sel);
      expect(m.transitionDuration, sel).toMatch(MOTIONLESS);
      expect(m.animationName, sel).toBe("none");
    }
  });

  test("Interests controls are motionless under prefers-reduced-motion", async ({
    page,
  }) => {
    await gotoInterests(page);
    const m = await motionOf(page, "button:has-text('Check sources now')");
    expect(m.transitionDuration).toMatch(MOTIONLESS);
    expect(m.animationName).toBe("none");
  });
});

test.describe("reduced motion (C8) — same build, no OS preference", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the control still has its (colour-only) transition — so the reduce assertions above measured the media query, not a dead style", async ({
    page,
  }) => {
    await gotoSettings(page);
    const m = await motionOf(page, "button:has-text('Apply changes')");
    expect(m.transitionDuration).not.toMatch(MOTIONLESS);
  });
});
