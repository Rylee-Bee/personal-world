import { test, expect, type Page } from "@playwright/test";
import { gotoArea } from "./helpers";

/**
 * §2.7 mobile safe areas — C12 rebuild fix (the parity doc's one named
 * genuine exposure: the old surface shipped mobile.css with a 44px floor
 * and a wrap-safe topbar; the rebuild must at least respect the
 * viewport safe-area insets on its sticky/fixed chrome).
 *
 * Headless Chromium reports env(safe-area-inset-*) as 0 everywhere, so
 * the spec simulates a notched device with the deterministic pin hook
 * in world.css: [data-pw-safe-area-pin] on <html> + --pw-safe-area-pin
 * replaces every inset with one fixed length. All expected geometry is
 * computed from that same PIN/spacing constant — never measured off a
 * hypothetical device, so nothing here is flaky by construction.
 *
 * Runs in the "chromium-mobile" project (chromium, phone viewport,
 * isMobile emulation) — see playwright.config.ts.
 */

const PIN = 34; // px — a notch-shaped inset the whole suite pins to
const SPACING_SM = 8; // --pw-spacing-sm (status strip base padding)
const SPACING_XL = 24; // --pw-spacing-xl (floating control / drawer base)
const TARGET_FLOOR = 44; // --pw-targets-minimum (WCAG 2.5.5)

async function pinInsets(page: Page) {
  await page.evaluate((px) => {
    const root = document.documentElement;
    root.style.setProperty("--pw-safe-area-pin", `${px}px`);
    root.setAttribute("data-pw-safe-area-pin", "");
  }, PIN);
}

async function computedCss(
  page: Page,
  selector: string,
  property: "padding-top" | "padding-bottom" | "padding-left" | "padding-right",
): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property);
}

test.describe("mobile safe areas (§2.7)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("the html shell opts into cover rendering for env() insets", async ({
    page,
  }) => {
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      "content",
      /viewport-fit=cover/,
    );
  });

  test("the layout never widens past the phone viewport (mobile.css lesson)", async ({
    page,
  }) => {
    // Under mobile emulation, one overflowing flex row inflates the
    // layout viewport and the whole page shrinks-to-fit — the exact
    // failure the old surface guarded with `min-width: 0`. If this
    // breaks, every geometry assertion below measures the wrong page.
    const width = await page.evaluate(() => window.innerWidth);
    expect(width).toBe(page.viewportSize()!.width);
  });

  test("with no inset reported, chrome adds zero padding (env() fallback is honest)", async ({
    page,
  }) => {
    // No pin: env(safe-area-inset-*, 0px) must fall back to 0px, i.e. the
    // insets never invent padding on flat screens.
    expect(await computedCss(page, "header", "padding-top")).toBe("0px");
    expect(await computedCss(page, "footer", "padding-bottom")).toBe(`${SPACING_SM}px`);
  });

  test("pinned insets: sticky header pads by the top inset and the nav control stays clear of it", async ({
    page,
  }) => {
    await pinInsets(page);
    expect(await computedCss(page, "header", "padding-top")).toBe(`${PIN}px`);

    const overview = page
      .getByRole("navigation", { name: "World navigation" })
      .getByRole("button", { name: "Overview" });
    const box = await overview.boundingBox();
    expect(box).not.toBeNull();
    // Named control fully below the pinned inset band, and still a 44px+
    // touch target (mobile.css re-affirmed that floor; the rebuild must
    // not drop it).
    expect(box!.y).toBeGreaterThanOrEqual(PIN);
    expect(box!.height).toBeGreaterThanOrEqual(TARGET_FLOOR);
  });

  test("pinned insets: sticky status strip pads its bottom by inset + base padding", async ({
    page,
  }) => {
    await pinInsets(page);
    // calc(--pw-spacing-sm + inset) — the strip's own padding survives
    // and the home-indicator band is added on top of it.
    expect(await computedCss(page, "footer", "padding-bottom")).toBe(
      `${SPACING_SM + PIN}px`,
    );
  });

  test("pinned insets: the floating assistant sits above the home-indicator band", async ({
    page,
  }) => {
    await pinInsets(page);
    const button = page.getByRole("button", { name: "Open World assistant" });
    await expect(button).toBeVisible();
    // The fixed wrapper's `bottom` is calc(24px + 34px) — exact, derived
    // from the pin, not sampled from a device.
    const gap = await button.evaluate((el) => {
      const wrap = el.parentElement;
      const style = wrap ? getComputedStyle(wrap) : getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        bottom: style.bottom,
        clearance: window.innerHeight - rect.bottom,
        height: rect.height,
      };
    });
    expect(gap.bottom).toBe(`${SPACING_XL + PIN}px`);
    expect(gap.clearance).toBeGreaterThanOrEqual(SPACING_XL + PIN);
    expect(gap.height).toBeGreaterThanOrEqual(TARGET_FLOOR);
  });

  test("pinned insets: journal WriteForm action bar pads by the bottom inset", async ({
    page,
  }) => {
    await gotoArea(page, "Memory");
    await pinInsets(page);
    const actions = page.locator("#journal-write-actions");
    await expect(actions).toBeVisible();
    expect(await computedCss(page, "#journal-write-actions", "padding-bottom")).toBe(
      `${PIN}px`,
    );
    const submit = page.getByRole("button", { name: "Submit journal entry" });
    const box = await submit.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(TARGET_FLOOR);
  });

  test("pinned insets: the fixed WorldDrawer keeps its close control out of every inset band", async ({
    page,
  }) => {
    await pinInsets(page);
    await page.getByRole("button", { name: "Open World assistant" }).click();
    const drawer = page.getByRole("dialog", { name: "World Assistant" });
    await expect(drawer).toBeVisible();

    // Drawer padding composes base + inset on the exposed sides.
    expect(await computedCss(page, 'dialog[aria-labelledby="world-drawer-title"]', "padding-top")).toBe(
      `${SPACING_XL + PIN}px`,
    );

    const close = drawer.getByRole("button", { name: "Close drawer" });
    const box = await close.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(PIN);
    const width = page.viewportSize()!.width;
    expect(box!.x + box!.width).toBeLessThanOrEqual(width - PIN);
    expect(Math.max(box!.height, box!.width)).toBeGreaterThanOrEqual(TARGET_FLOOR);
  });
});
