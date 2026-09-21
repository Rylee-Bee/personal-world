import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Navigate by the world-nav buttons only. Scoped to the navigation
 * landmark so same-named buttons elsewhere (Today's area links render
 * buttons too) can never trip Playwright's strict mode.
 */
export async function gotoArea(page: Page, name: string) {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "World navigation" })
    .getByRole("button", { name })
    .click();
}

/**
 * Shared e2e helpers for Track C specs (C7 focus ring / keyboard
 * paths). Kept honest to the a11y contract: rings are asserted only
 * after KEYBOARD arrival (Tab), because :focus-visible is a
 * keyboard-truth rule — programmatic focus() would test the wrong
 * thing.
 */

/**
 * The composed ring literal for the ACTIVE production theme (station):
 * 2px solid #72b1b1 with 2px offset — the same composition
 * tests/test_design_tokens.py guards at the token layer
 * (docs/accessibility/ACCESSIBILITY_CONTRACT.md §2.4).
 */
export const RING = {
  width: "2px",
  style: "solid",
  color: "rgb(114, 177, 177)",
  offset: "2px",
};

export async function focusRingOf(locator: Locator) {
  return locator.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      width: cs.outlineWidth,
      style: cs.outlineStyle,
      color: cs.outlineColor,
      offset: cs.outlineOffset,
    };
  });
}

/**
 * Tab forward until the active element IS `locator`; then assert the
 * composed ring.
 *
 * expect.poll, not a single snapshot: `transition-colors` legitimately
 * includes outline-color, so a WorldButton's ring ANIMATES from the
 * text colour to the accent over the (colour-only, ≤150ms) transition.
 * Sampling once raced the animation; polling states the real contract
 * — the composed ring arrives — without weakening anything. Under
 * prefers-reduced-motion the arrival is instant (see reduced-motion
 * spec).
 */
export async function expectKeyboardFocusRing(
  page: Page,
  locator: Locator,
  label?: string,
  maxTabs = 160,
) {
  let reached = false;
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press("Tab");
    reached = await locator
      .evaluate((el) => el === document.activeElement)
      .catch(() => false);
    if (reached) break;
  }
  if (!reached) {
    throw new Error(
      `${label ?? "focus ring target"}: never reached by Tab within the budget`,
    );
  }
  await expect
    .poll(async () => focusRingOf(locator), {
      message: `${label ?? "focus ring"}: composed ring must arrive (a11y §2.4)`,
      timeout: 5_000,
    })
    .toEqual(RING);
}
