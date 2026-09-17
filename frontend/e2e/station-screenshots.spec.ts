/**
 * Station documentation screenshots — deterministic + sanitized.
 *
 * Captures the Station's own pages (served at /station/) for the README.
 * Determinism, so a run leaves git clean:
 *  - reduced motion: the ambient companion "egg" and all ambient animation
 *    are off by contract (ACCESSIBILITY_CONTRACT §6.2), and screenshot
 *    `animations: "disabled"` freezes what remains;
 *  - `Date.now` is pinned so any relative age renders identically;
 *  - `Math.random` is seeded so a stray call cannot move a pixel;
 *  - source-control / projects-status routes are fulfilled with an empty
 *    NOT_CONFIGURED payload so no repository path or host detail reaches a
 *    pixel (the e2e server otherwise points search_paths at the repo).
 *
 * Run: cd frontend && npm run docs:screenshots
 */
import { test, expect, type Page } from "playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { TOKEN } from "./helpers";

const OUT = resolve(import.meta.dirname, "..", "..", "docs", "screenshots");
mkdirSync(OUT, { recursive: true });

const NOT_CONFIGURED = {
  ok: true,
  status: "not_configured",
  warnings: [],
  data: {},
};

test.use({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });

async function seedDeterminism(page: Page) {
  await page.addInitScript(() => {
    // Fixed clock: relative ages render identically every run.
    const FIXED = 1_788_000_000_000;
    const RealDate = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        if (args.length === 0) super(FIXED);
        else super(...(args as []));
      }
      static now() {
        return FIXED;
      }
    } as DateConstructor;
    // Seeded PRNG (belt-and-braces; reduced motion already suppresses the egg).
    let s = 42;
    Math.random = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    try {
      localStorage.setItem("pw-onboarded", "1"); // skip the first-visit dialog
      localStorage.setItem("pw-station-companions", "off");
    } catch {
      /* about:blank */
    }
  });
}

async function login(page: Page) {
  const res = await page.request.post("/api/auth/login", { data: { token: TOKEN } });
  expect(res.ok(), "POST /api/auth/login must mint a session").toBeTruthy();
}

async function capture(page: Page, path: string, file: string) {
  await page.goto(`/station/${path}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector("main", { state: "attached" });
  // Let the map/views render from the facade (no network is in flight here;
  // the pinned clock + reduced motion keep it stable).
  await page.waitForTimeout(400);
  await page.screenshot({
    path: resolve(OUT, file),
    fullPage: true,
    animations: "disabled",
  });
}

test.describe("Station documentation screenshots", () => {
  test("the map and content views", async ({ page }) => {
    await seedDeterminism(page);
    const empty = { json: NOT_CONFIGURED };
    await page.route("**/api/source-control/status*", (r) => r.fulfill(empty));
    await page.route("**/api/projects/status*", (r) => r.fulfill(empty));
    await login(page);

    await capture(page, "index.html", "station-map.png");
    await capture(page, "journal.html", "station-journal.png");
    await capture(page, "interests.html", "station-interests.png");
    await capture(page, "projects.html", "station-projects.png");
    await capture(page, "settings.html", "station-settings.png");
    await capture(page, "chat.html", "station-chat.png");
  });
});