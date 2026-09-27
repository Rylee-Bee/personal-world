/**
 * Book Girl's setting: how to be taught, saved per person, and she holds
 * still (glowing) when motion is reduced.
 */
import { test, expect } from "./test";
import AxeBuilder from "@axe-core/playwright";
import { gotoArea } from "./helpers";

test("Settings: choose how Book Girl teaches, saved in words", async ({ page }) => {
  let mode = "build";
  const puts: string[] = [];
  await page.route("**/api/learning", (route) => route.fulfill({ json: { ok: true, data: { mode, concepts: {} } } }));
  await page.route("**/api/learning/mode", (route) => {
    mode = route.request().postDataJSON().mode;
    puts.push(mode);
    return route.fulfill({ json: { ok: true, data: { mode } } });
  });
  await gotoArea(page, "Settings");
  const section = page.getByRole("region", { name: "Book Girl" });
  await expect(section.getByRole("button", { name: "Teach me as I build" })).toHaveAttribute("aria-pressed", "true");
  await section.getByRole("button", { name: "Occasional tips" }).click();
  await expect(section.getByRole("status")).toHaveText("Saved: occasional tips.");
  await expect(section.getByRole("button", { name: "Occasional tips" })).toHaveAttribute("aria-pressed", "true");
  await expect(section.getByText("At most one a day.")).toBeVisible();
  expect(puts).toEqual(["occasional"]);
  await section.scrollIntoViewIfNeeded();
  await section.screenshot({ path: "test-results/book-girl-setting.png" });
  const results = await new AxeBuilder({ page }).include("section[aria-labelledby='settings-bookgirl-heading']").analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("with reduced motion she holds still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/learning", (route) => route.fulfill({ json: { ok: true, data: { mode: "build", concepts: {} } } }));
  await gotoArea(page, "Settings");
  const svg = page.getByRole("region", { name: "Book Girl" }).locator("svg.bookgirl");
  await expect(svg).toBeVisible();
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && String((a as CSSAnimation).animationName ?? "").startsWith("bookgirl")).length);
  expect(running).toBe(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("Chat: when a reply names an idea, Book Girl sits beside it and teaches only when tapped", async ({ page }) => {
  const entries: { ts: number; role: string; content: string }[] = [];
  const gotIt: string[] = [];
  await page.route("**/api/chat/history*", (route) => route.fulfill({ json: { ok: true, data: { entries } } }));
  await page.route("**/api/learning/got-it", (route) => {
    gotIt.push(route.request().postDataJSON().concept);
    return route.fulfill({ json: { ok: true, data: { concept: "gating", stage: "again" } } });
  });
  await page.route("**/api/chat", (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const { message } = route.request().postDataJSON();
    const reply = "Done: the door only shows once the lantern is in your bag.";
    entries.push({ ts: 1, role: "user", content: message }, { ts: 2, role: "assistant", content: reply });
    return route.fulfill({
      json: { ok: true, data: { reply, provider: "fixture", learning: { concept: "gating", stage: "first", book: "worlds:gating" } } },
    });
  });
  await gotoArea(page, "Chat");
  const box = page.getByRole("textbox").first();
  await box.fill("A hidden door you can't find until you have the lantern.");
  await box.press("Enter");
  await expect(page.getByText("Done: the door only shows once the lantern is in your bag.")).toBeVisible();
  const her = page.getByRole("button", { name: "There’s a name for something you just made (optional)" });
  await expect(her).toBeVisible();
  await expect(page.getByText(/There’s a name for part of what you just made/)).toHaveCount(0);
  await her.click();
  await expect(page.getByText("📚 There’s a name for part of what you just made. Gating: getting to something depends on meeting a condition first.")).toBeVisible();
  await page.screenshot({ path: "test-results/book-girl-chat.png" });
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByText("She’ll get quieter about gating from here.")).toBeVisible();
  expect(gotIt).toEqual(["gating"]);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
