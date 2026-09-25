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
 * unconditional), motion-reduce:transition-none on components, and —
 * since C12 applies prefs to the DOM — the prefs layer's LAST rule,
 * an OS override that outranks even the !important tier rules, plus
 * prefs-dom.ts clamping the inline motion tokens. prefs.py documents
 * that OS prefers-reduced-motion always wins.
 */

async function gotoSettings(page: Page) {
  await page.goto("/");
  // Nav-scoped — the Bridge's lenses also say "Settings".
  await page
    .getByRole("navigation", { name: "World navigation" })
    .getByRole("button", { name: "Settings" })
    .click();
  await expect(
    page.getByRole("region", { name: "Customize" }),
  ).toBeVisible();
}

async function gotoInterests(page: Page) {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "World navigation" })
    .getByRole("button", { name: "Interests" })
    .click();
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

/**
 * Pin the motion pref for THIS browser context by answering
 * GET /api/prefs locally — no shared-state mutation, so the spec
 * cannot race the Settings Room specs running in other workers.
 * Mirrors scripts/e2e-api.mjs' envelope exactly.
 */
async function withMotionPref(
  page: Page,
  motion: "off" | "reduced" | "subtle",
) {
  await page.route("**/api/prefs", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: {
            ok: true,
            status: "healthy",
            data: {
              motion,
              contrast: "comfortable",
              text_scale: 1,
              density: "comfortable",
              target_size: 44,
              companion: "mermaid",
              accent: "world-keeper",
            },
          },
        })
      : route.fallback(),
  );
}

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

  test("under the subtle motion pref the control still transitions — so the reduce assertions above measured the media query, not a dead style", async ({
    page,
  }) => {
    // C12 applied the prefs layer, and the mock station's stored value
    // can be any tier while this suite runs in parallel; the
    // comparison branch therefore pins "subtle" locally — the only
    // tier that legitimately allows motion.
    await withMotionPref(page, "subtle");
    await gotoSettings(page);
    await expect(page.locator("html")).toHaveAttribute(
      "data-pw-motion",
      "subtle",
    );
    const m = await motionOf(page, "button:has-text('Apply changes')");
    expect(m.transitionDuration).not.toMatch(MOTIONLESS);
    // The subtle tier's own budget (prefs.py MOTION_TIERS) now owns
    // the duration — proof the applied-prefs CSS layer is live.
    expect(m.transitionDuration).toBe("0.2s");
  });
});

/**
 * C12 firewall (Staff Meeting #4 item 2 / ACCESSIBILITY_CONTRACT §6.2):
 * an explicit user motion pref may only REDUCE motion — it can never
 * force motion over the OS prefers-reduced-motion floor. This is the
 * dangerous combination (user picked "subtle", OS says "reduce"),
 * asserted end to end: the attribute stays server-honest, while the
 * computed styles — via BOTH enforcement points, the clamped inline
 * tokens in prefs-dom.ts and the last-rule override in world.css —
 * are motionless.
 */
test.describe("motion pref firewall (C12) — explicit pref vs OS floor", () => {
  test.use({ reducedMotion: "reduce" });

  test("'Subtle motion' applied from the server cannot override prefers-reduced-motion", async ({
    page,
  }) => {
    await withMotionPref(page, "subtle");
    await gotoSettings(page);

    // Server truth stays visible: the attribute reports what the
    // station stores…
    await expect(page.locator("html")).toHaveAttribute(
      "data-pw-motion",
      "subtle",
    );
    // …while the motion budget is clamped to the motionless tier.
    const tokens = await page
      .locator("html")
      .evaluate((el) => ({
        duration: el.style.getPropertyValue("--pw-motion-duration"),
        ambient: el.style.getPropertyValue("--pw-motion-ambient"),
      }));
    expect(tokens.duration).toBe("0ms");
    expect(tokens.ambient).toBe("0");

    // And the rendered result is motionless anyway — the tier rules
    // may never beat the floor.
    const m = await motionOf(page, "button:has-text('Apply changes')");
    expect(m.transitionDuration).toMatch(MOTIONLESS);
    expect(m.animationName).toBe("none");
  });
});
