/**
 * Documentation screenshots — deterministic, sanitized, repeatable.
 *
 * Generates screenshots for README and docs. Uses the real e2e server
 * with a synthetic demo world. No real personal data.
 *
 * Run: cd frontend && npx playwright test e2e/docs-screenshots.spec.ts
 */
import { test } from "playwright/test";
import { login, bootWait } from "./helpers";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SCREENSHOT_DIR = resolve(import.meta.dirname, "..", "..", "docs", "screenshots");
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

test.beforeAll(() => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

// Freeze the clock so date-derived copy (greeting, weekday, relative
// "observed N minutes ago" ages, journal day labels) renders identically
// on every run. These PNGs are tracked files; without a fixed clock they
// churned on every run/day and left the working tree dirty.
//
// The shared e2e server points source-control at the repo itself so the
// projects e2e exercises real git. That makes the estate state (dirty
// branches, observation ages) leak into these screenshots and change
// with every commit — violating this file's "deterministic, sanitized,
// repeatable" contract, and printing local branch names into a public
// README. Answer the two estate endpoints with the honest not_configured
// / empty envelopes instead: a real product state, with no local detail.
const NOT_CONFIGURED = {
  ok: false,
  status: "not_configured",
  warnings: ["no source_control search paths configured"],
};

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-01-15T15:00:00Z"));
  await page.route("**/api/source-control/status*", (route) =>
    route.fulfill({ json: NOT_CONFIGURED })
  );
  await page.route("**/api/projects/status*", (route) =>
    route.fulfill({ json: { ok: true, data: { projects: [] } } })
  );
});

async function waitForContent(page: import("playwright/test").Page) {
  await bootWait(page);
  // Wait for any API-driven content to settle
  await page.waitForTimeout(1000);
}

test.describe("documentation screenshots — desktop", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("Today screen", async ({ page }) => {
    await login(page);
    await page.goto("/");
    await waitForContent(page);
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "project-worlds-today.png"),
      fullPage: false,
    });
  });

  test("Projects screen", async ({ page }) => {
    await login(page);
    await page.goto("/projects");
    await waitForContent(page);
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "project-worlds-projects.png"),
      fullPage: false,
    });
  });

  test("Lab screen", async ({ page }) => {
    await login(page);
    await page.goto("/lab");
    await waitForContent(page);
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "project-worlds-lab.png"),
      fullPage: false,
    });
  });

  test("Media screen (empty state)", async ({ page }) => {
    await login(page);
    await page.goto("/media");
    await waitForContent(page);
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "project-worlds-media.png"),
      fullPage: false,
    });
  });

  test("Interests screen", async ({ page }) => {
    await login(page);
    await page.goto("/interests");
    await waitForContent(page);
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "project-worlds-interests.png"),
      fullPage: false,
    });
  });

  test("Journal screen", async ({ page }) => {
    await login(page);
    await page.goto("/journal");
    await waitForContent(page);
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "project-worlds-journal.png"),
      fullPage: false,
    });
  });

  test("Chat / Assistant screen", async ({ page }) => {
    await login(page);
    await page.goto("/chat");
    await waitForContent(page);
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "project-worlds-assistant.png"),
      fullPage: false,
    });
  });

  test("Settings — Connections & Providers", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await waitForContent(page);
    // Scroll to connections panel
    const panel = page.locator('[data-testid="connections-panel"]');
    if (await panel.isVisible()) {
      await panel.scrollIntoViewIfNeeded();
    }
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "project-worlds-settings-connections.png"),
      fullPage: false,
    });
  });

  test("Settings — Brain", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await waitForContent(page);
    // Scroll to brain panel
    const panel = page.locator('[data-testid="brain-panel"]');
    if (await panel.isVisible()) {
      await panel.scrollIntoViewIfNeeded();
    }
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "project-worlds-settings-brain.png"),
      fullPage: false,
    });
  });

  test("World screen", async ({ page }) => {
    await login(page);
    await page.goto("/world");
    await waitForContent(page);
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "project-worlds-world.png"),
      fullPage: false,
    });
  });
});

test.describe("documentation screenshots — mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE);
  });

  test("Today screen (mobile)", async ({ page }) => {
    await login(page);
    await page.goto("/");
    await waitForContent(page);
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "project-worlds-today-mobile.png"),
      fullPage: false,
    });
  });
});
