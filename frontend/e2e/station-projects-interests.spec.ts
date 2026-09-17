/**
 * Projects + Interests content views: real reads, honest states.
 *
 * The seeded fixture (e2e/server.mjs) points the REAL source_control
 * search_paths at this repository, so the Projects view must render
 * real repositories — no specimen estate, no invented five-repo demo
 * (LANG-018). The gate explains instead of proposing (LANG-019), and
 * its reassurance is scoped to what the view can prove (LANG-020).
 * Interests reads API-051: the honest empty state when nothing is
 * configured, never a sample feed (LANG-022).
 */
import { test, expect, type Page } from "playwright/test";
import { TOKEN } from "./helpers";

async function login(page: Page) {
  const res = await page.request.post("/api/auth/login", { data: { token: TOKEN } });
  expect(res.ok(), "POST /api/auth/login must mint a pw_session cookie").toBeTruthy();
}

async function gotoPage(page: Page, path: string) {
  await page.addInitScript(() => {
    try { localStorage.setItem("pw-onboarded", "1"); } catch { /* about:blank */ }
  });
  await page.goto(`/station/${path}`);
  await page.waitForSelector("main#main");
}

test.describe("projects view — real source-control reads", () => {
  test("not_configured: one honest state, no sample repositories fill the gap", async ({ page }) => {
    const empty = { json: { ok: false, status: "not_configured", warnings: ["no source_control search paths configured"], data: {} } };
    await page.route("**/api/source-control/status*", (r) => r.fulfill(empty));
    await login(page);
    await gotoPage(page, "projects.html");
    const text = await page.locator("#projects-view").innerText();
    expect(text).toContain("Your repositories are not set up.");
    expect(text).not.toMatch(/lantern-notes|agent-sketches|specimen/i);
    await page.waitForTimeout(500);
    expect(await page.locator(".pv-repo-btn").count()).toBe(0);
  });

  test("source-control down: names the failure, refuses to guess, offers Try again", async ({ page }) => {
    await login(page);
    await page.route("**/api/source-control/status*", (r) => r.abort());
    await gotoPage(page, "projects.html");
    const text = await page.locator("main#main").innerText();
    expect(text).toContain("Couldn’t check your repositories");
    expect(page.locator("[data-pv-retry]")).toBeVisible();
    // recovery is real: unroute and retry paints the actual state
    await page.unroute("**/api/source-control/status*");
    await page.locator("[data-pv-retry]").click();
    await expect(page.locator(".pv-repo-btn")).toHaveCount(1);
  });
});

  test("renders the real repo list; no specimen estate; the gate explains instead of proposing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await login(page);
    await gotoPage(page, "projects.html");
    await expect(page.locator(".pv-repo-btn")).toHaveCount(1); // the repo under test, real
    // the old specimen five-repo estate is gone from the normal route
    const text = await page.locator("#projects-view").innerText();
    for (const fake of ["lantern-notes", "pickle", "agent-sketches", "old-notebooks"]) {
      expect(text).not.toContain(fake);
    }
    expect(text).not.toContain("specimen · sample");
    // commit messages are the repository's real history and may use any
    // word (a commit titled "replacing the specimen feed" is truth) —
    // the no-specimen gate applies to the rendered estate, asserted above
    expect(page.locator(".specimen-note, .cv-specimen")).toHaveCount(0);
    expect(text).not.toContain("/home/"); // no filesystem path leakage
    // the write gate explains; it does not promise a proposal that does not exist
    const gate = page.locator("#pv-gate-btn");
    await expect(gate).toContainText("How project refresh would work");
    await gate.click();
    await expect(page.locator("#pv-gate-panel")).toContainText(
      "This explanation did not run a command or change this repository."
    );
    await expect(page.locator("#pv-gate-panel")).toContainText("not wired");
    // the file tree is gone for good reason: no read provides one
    expect(page.locator(".pv-tree")).toHaveCount(0);
    // the commit history is a real read for the selected repository
    await expect(page.locator(".pv-commits .pv-commit").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

test.describe("interests view — real discovery read, no specimen feed", () => {
  test("the empty fixture renders the honest empty state; no sample cards, no prototype controls", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await login(page);
    await gotoPage(page, "interests.html");
    const view = page.locator("#interests-view");
    await expect(view.locator(".cv-state-box")).toBeVisible();
    await expect(view).toContainText("No interests yet");
    await expect(view).toContainText("genuinely empty, not sample content");
    const text = await view.innerText();
    expect(text).not.toContain("specimen");
    expect(text).not.toContain("Preview state · prototype control");
    expect(text).not.toContain("local-first software"); // a specimen headline
    expect(errors).toEqual([]);
  });

  test("unavailable: names the failure and offers a real retry", async ({ page }) => {
    await login(page);
    await page.route("**/api/discovery/interests*", (r) => r.abort());
    await gotoPage(page, "interests.html");
    const view = page.locator("#interests-view");
    await expect(view).toContainText("Couldn’t check your interests");
    await page.unroute("**/api/discovery/interests*");
    await view.locator("[data-cv-retry]").click();
    await expect(view).toContainText("No interests yet");
  });
});
