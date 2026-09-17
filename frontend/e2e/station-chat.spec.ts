/**
 * UX-01 / LANG-053 — chat wiring honesty gates.
 *
 * The Talk page sends to the REAL POST /api/chat and renders whatever
 * the server answered — nothing is invented in the room. The seeded
 * e2e world has no chat provider, so every send lands on the honest
 * no-assistant state exactly once per send, with the message kept.
 * The old fake per-send "system line" behavior is dead: no
 * "heard you as…" copy, no API jargon in the visible room.
 *
 * LANG-053: the corner-orb trigger opens the (now real) World
 * assistant, so its accessible name names the function:
 * "Open World assistant".
 */
import { test, expect, type Page } from "playwright/test";
import { TOKEN, collectErrors } from "./helpers";

test.use({ reducedMotion: "reduce" });

async function login(page: Page) {
  const res = await page.request.post("/api/auth/login", { data: { token: TOKEN } });
  expect(res.ok()).toBeTruthy();
}

async function gotoStation(page: Page, path: string) {
  await page.addInitScript(() => {
    try { localStorage.setItem("pw-onboarded", "1"); } catch { /* about:blank */ }
  });
  await page.goto(`/station/${path}`);
  await page.waitForSelector("main", { state: "attached" });
}

test.describe("Talk page honesty", () => {
  test("send reaches the real endpoint; without a provider the room stays honest", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await login(page);
    await gotoStation(page, "chat.html");
    const log = page.locator("#chat-root .chat-log");
    await page.fill("#chat-in-chat-root", "Is anything wrong with my world today?");
    await page.click(".chat-send");
    await expect(log).toContainText("No assistant is connected yet.");
    await expect(log).toContainText("Your message is saved in this browser.");
    // the message itself is really in the room (kept locally on failure)
    await expect(log).toContainText("Is anything wrong with my world today?");
    // no fake "heard you" system lines, no API jargon in the room
    const text = (await log.textContent()) ?? "";
    expect(text).not.toMatch(/heard you|nothing is invented|API-010/);
    expect(errors).toEqual([]);
  });

  test("empty state names where answers and transcripts live", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page);
    await gotoStation(page, "chat.html");
    const log = page.locator("#chat-root .chat-log");
    await expect(log).toContainText("Replies come from the Project Worlds assistant");
    expect(errors).toEqual([]);
  });
});

test.describe("companion trigger name (LANG-053)", () => {
  test("the orb's accessible name is Open World assistant (function, not character)", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await login(page);
    await gotoStation(page, "chat.html");
    const orb = page.locator("#companion-orb");
    await expect(orb).toBeVisible();
    await expect(orb).toHaveAccessibleName("Open World assistant");
    expect(errors).toEqual([]);
  });
});
