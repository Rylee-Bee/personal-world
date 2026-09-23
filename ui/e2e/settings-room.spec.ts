import { test, expect, type Page } from "@playwright/test";
import { expectKeyboardFocusRing, gotoArea } from "./helpers";

/**
 * C7 focus-ring contract + C2 undo-visible flow + C1 typed controls —
 * e2e on the production preview build against the deterministic mock
 * station (scripts/e2e-api.mjs).
 *
 * The focus assertions are the UI-side counterpart to
 * tests/test_design_tokens.py's per-theme composition guard: that test
 * proves the RING LITERAL composes to a valid 2px solid value per
 * theme; this proves the rendered controls actually COMPUTE to it —
 * reached by keyboard only (Tab), never by programmatic focus(), so
 * the :focus-visible rule under test is the real rule.
 */

async function gotoSettings(page: Page) {
  await gotoArea(page, "Settings");
  await expect(
    page.getByRole("heading", { name: "Settings", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Customize" }),
  ).toBeVisible();
}

const MOTION_WORDS: Record<string, string> = {
  off: "No motion",
  reduced: "Reduced motion",
  subtle: "Subtle motion",
};

// The C2 and C12 flows both toggle the SHARED motion pref in the
// stateful mock store (scripts/e2e-api.mjs, one process for the whole
// run). Under fullyParallel they land on different workers and race:
// C12's "reduced" apply could overwrite C2's "subtle" apply between
// C2's write and its reload-verify (observed ~50% at d3e6999, pre-
// existing). Serial within the file — same remedy journal-draft.spec
// and vault-in-settings.spec already carry for the same store.
test.describe.configure({ mode: "serial" });

test.describe("Settings Room (C1/C2)", () => {
  test("renders a typed control for every key the server schema describes", async ({
    page,
  }) => {
    await gotoSettings(page);
    for (const key of [
      "accent",
      "companion",
      "contrast",
      "density",
      "motion",
      "personality_pack",
      "target_size",
      "text_scale",
      "tone",
    ]) {
      await expect(page.locator(`#settings-room-${key}-control`)).toBeVisible();
    }
    // Only server-legal values are offered.
    const options = await page
      .locator("#settings-room-motion-control")
      .locator("option")
      .allTextContents();
    expect(options).toEqual(["No motion", "Reduced motion", "Subtle motion"]);
    // The one voice's registers (TRUE-NORTH § Voice) — the closed set,
    // warm named as the default.
    const toneOptions = await page
      .locator("#settings-room-tone-control")
      .locator("option")
      .allTextContents();
    expect(toneOptions).toEqual([
      "Warm (default)",
      "Concise",
      "Playful",
      "Formal",
    ]);
    const packOptions = await page
      .locator("#settings-room-personality_pack-control")
      .locator("option")
      .allTextContents();
    expect(packOptions).toEqual([
      "Off (the one voice)",
      "Residents (optional character pack)",
    ]);
  });

  test("tone apply persists to the server and lands on the document (W1-B)", async ({
    page,
  }) => {
    // The tone pref round-trips: PUT /api/prefs persists it (shared
    // mock store) and the C12 chrome applies it to <html> as
    // data-pw-tone — the same server truth tone-aware copy
    // (language/tone.ts) and the CSS layer read.
    await gotoSettings(page);
    const tone = page.locator("#settings-room-tone-control");
    const before = await tone.inputValue();
    const next = before === "concise" ? "warm" : "concise";
    await tone.selectOption(next);
    await page.getByRole("button", { name: /Apply changes/ }).click();
    await expect(page.getByRole("status").filter({ hasText: /Saved/ })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-pw-tone", next);

    // Restore the warm default so the shared store is idempotent for
    // the rest of the suite (serial file, same store as C2/C12).
    if (next !== "warm") {
      await tone.selectOption("warm");
      await page.getByRole("button", { name: /Apply changes/ }).click();
      await expect(page.getByRole("status").filter({ hasText: /Saved/ })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-pw-tone", "warm");
    }
  });

  test("nothing auto-persists: change previews with undo, Apply writes once, and the applied diff stays visible (C2)", async ({
    page,
  }) => {
    await gotoSettings(page);
    const motion = page.locator("#settings-room-motion-control");
    const apply = page.getByRole("button", { name: /Apply changes/ });

    // Value-aware so the flow is idempotent across reruns against the
    // stateful mock store: move to whichever motion value is NOT live.
    const before = await motion.inputValue();
    const next = before === "subtle" ? "off" : "subtle";
    const previewLine = `Motion: ${MOTION_WORDS[before]} → ${MOTION_WORDS[next]}`;

    // Apply starts inert — there is nothing to apply.
    await expect(apply).toBeDisabled();

    await motion.selectOption(next);
    await expect(page.getByText(previewLine)).toBeVisible();
    await expect(apply).toBeEnabled();

    // Undo is keyboard-operable and reverts the draft without any write.
    const undo = page.getByRole("button", { name: "Undo change to Motion" });
    await undo.focus();
    await undo.press("Enter");
    await expect(page.getByText(previewLine)).toHaveCount(0);
    await expect(apply).toBeDisabled();

    // Re-draft, then Apply once; the applied diff stays visible (C2).
    await motion.selectOption(next);
    await apply.click();
    await expect(page.getByText("Saved 1 setting.")).toBeVisible();
    await expect(
      page.getByText(`Last apply changed 1 setting: motion ${before}→${next}`),
    ).toBeVisible();

    // The station actually kept it: a full reload (the SPA is
    // state-routed — no URL yet, the deeplink gap C11 records) plus
    // re-navigation must come up with the NEW value, not the default.
    await page.reload();
    await gotoArea(page, "Settings");
    await expect(
      page.getByRole("region", { name: "Customize" }),
    ).toBeVisible();
    await expect(motion).toHaveValue(next);

    // Restore the previous baseline through the same honest path.
    await motion.selectOption(before);
    await page.getByRole("button", { name: "Apply changes (1)" }).click();
    await expect(page.getByText("Saved 1 setting.")).toBeVisible();
  });

  /**
   * C12 — the blocker C11 named: settings were EDITABLE (C1/C2) but
   * never APPLIED. Applying now mutates <html> with prefs.py's own
   * data-pw-* attributes / --pw-* variables, the computed styles
   * follow (world.css prefs layer), and a reload re-applies from
   * server truth with no user interaction.
   */
  test("applied prefs land on the document — and a reload re-applies them from server truth (C12)", async ({
    page,
  }) => {
    await gotoSettings(page);
    const motion = page.locator("#settings-room-motion-control");
    const root = page.locator("html");
    const applyButton = page.getByRole("button", { name: /Apply changes/ });
    const before = await motion.inputValue();

    const transitionDuration = () =>
      page
        .locator("button:has-text('Apply changes')")
        .evaluate((el) => getComputedStyle(el).transitionDuration);

    // 1) "Subtle motion" applied → the tier's 200ms budget shows up in
    //    computed style (the browser project emulates NO OS
    //    reduced-motion preference, so this is purely the pref).
    if (before !== "subtle") {
      await motion.selectOption("subtle");
      await applyButton.click();
      await expect(page.getByText("Saved 1 setting.")).toBeVisible();
    }
    await expect(root).toHaveAttribute("data-pw-motion", "subtle");
    expect(await transitionDuration()).toBe("0.2s");

    // 2) "Reduced motion" applied → attribute flips, transitions go
    //    instant. A pref may reduce; that is the whole product.
    await motion.selectOption("reduced");
    await applyButton.click();
    await expect(page.getByText("Saved 1 setting.")).toBeVisible();
    await expect(root).toHaveAttribute("data-pw-motion", "reduced");
    expect(await transitionDuration()).toBe("0s");

    // 3) Full reload: the document is marked again from the server's
    //    GET /api/prefs — before anyone touches Settings.
    await page.reload();
    await expect(root).toHaveAttribute("data-pw-motion", "reduced");
    expect(
      await page
        .getByRole("banner")
        .evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe("0s");

    // 4) Leave the shared mock store as it was found.
    if (before !== "reduced") {
      await gotoArea(page, "Settings");
      await motion.selectOption(before);
      await page.getByRole("button", { name: /Apply changes \(1\)/ }).click();
      await expect(page.getByText("Saved 1 setting.")).toBeVisible();
    }
  });

  /**
   * Theme is the one presentation key with no server write endpoint
   * (GET /api/themes serves packs; nothing stores a choice) — so it is
   * device truth: localStorage + data-theme, exactly the old
   * station.js chrome's model, and the Theme section says so plainly.
   */
  test("the chosen theme survives a reload on this device — device-local, as stated (C12)", async ({
    page,
  }) => {
    await gotoSettings(page);
    const root = page.locator("html");

    // Ocean, not Plain: clicking an already-active radio is a DOM
    // no-op (no change event), and plain is the first-run default
    // since D2 — persistence can only be proven for a theme that
    // differs from what boot applied.
    await page.getByText("Ocean", { exact: true }).click();
    await expect(root).toHaveAttribute("data-theme", "ocean");
    expect(
      await page.evaluate(() => window.localStorage.getItem("pw-station-theme")),
    ).toBe("ocean");

    // Reload lands on Today — the chrome still applies the stored
    // theme before anything is clicked.
    await page.reload();
    await expect(root).toHaveAttribute("data-theme", "ocean");

    // Back to the attribute-free Station theme (no data-theme) for
    // whatever spec runs next on this browser context.
    await gotoArea(page, "Settings");
    await page.getByText("Station", { exact: true }).click();
    await expect.poll(() => root.evaluate((el) => el.hasAttribute("data-theme"))).toBe(false);
  });

  test("the C10 label lives in exactly one discoverable place (the settings preview panel)", async ({
    page,
  }) => {
    await gotoSettings(page);
    await expect(
      page.getByText(/language dials — not yet wired/),
    ).toHaveCount(1);
    // Not scattered: navigating away shows none of it.
    await gotoArea(page, "Overview");
    await expect(
      page.getByText(/language dials — not yet wired/),
    ).toHaveCount(0);
  });

  test("every Settings Room control shows the composed focus ring when reached by Tab (C7)", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await gotoSettings(page);
    // Source order (§2.5): controls render sorted by key.
    for (const key of [
      "accent",
      "companion",
      "contrast",
      "density",
      "motion",
      "target_size",
      "text_scale",
    ]) {
      await expectKeyboardFocusRing(
        page,
        page.locator(`#settings-room-${key}-control`),
        `focus ring on ${key}`,
      );
    }

    // Draft one change, then reach the per-change Undo and Apply by Tab.
    const motion = page.locator("#settings-room-motion-control");
    const before = await motion.inputValue();
    await motion.selectOption(before === "subtle" ? "off" : "subtle");
    await expectKeyboardFocusRing(
      page,
      page.getByRole("button", { name: "Undo change to Motion" }),
      "focus ring on Undo",
    );
    await expectKeyboardFocusRing(
      page,
      page.getByRole("button", { name: /Apply changes/ }),
      "focus ring on Apply",
    );

    // Leave no draft behind.
    await page.getByRole("button", { name: "Revert all changes" }).click();
  });
});
