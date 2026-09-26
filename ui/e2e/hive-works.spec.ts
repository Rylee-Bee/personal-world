/**
 * Hive Works (ROOM 2.1.0): decisions answered with one tap on a choice,
 * the room's own "Re-check the tickets" action, and a long needs list
 * trimmed to the newest few with "Show all". Made-up data only.
 */
import { test, expect } from "./test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ request }) => {
  await request.delete("/api/__test/reset");
});

const DECISIONS = Array.from({ length: 8 }, (_, i) => ({
  id: `decision-${i + 1}`,
  title: `Decision ${i + 1}: which label for the board column?`,
  why: i === 0 ? "Recommended: Doing. It matches the other boards." : "Pick whichever reads best to you.",
  actions: ["answer-decision"],
  created_at: `2026-09-2${i < 5 ? 6 : 1}T0${i}:00:00Z`,
  choices: i === 0 ? ["Doing", "In progress", "Started"] : ["Yes", "No"],
}));

async function withHive(page: Page, answered: string[]) {
  await page.route("**/api/rooms", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const studio = body.data.find((r: { id: string }) => r.id === "studio");
    body.data.push({
      ...studio,
      id: "hive-works",
      base_url: "http://127.0.0.1:8950",
      room: { ...studio.room, id: "hive-works", name: "Hive Works", icon: "hexagon" },
      needs_you: DECISIONS.filter((d) => !answered.includes(d.id)),
      cards: [],
      keeper: null,
      doorway: null,
      actions: [
        { id: "answer-decision", title: "Answer a decision", writes: true },
        { id: "run-freshness", title: "Re-check the tickets", writes: false },
      ],
    });
    await route.fulfill({ response, json: body });
  });
}

test("Hive Works: newest five first, Show all moves focus to the next one", async ({ page }) => {
  await withHive(page, []);
  await page.goto("/");
  await page.getByRole("button", { name: "Look inside Hive Works" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/hive-works-bridge.png" });
  await page.getByRole("button", { name: "Look inside Hive Works" }).click();
  const drawer = page.getByRole("dialog", { name: "Hive Works" });
  await expect(drawer.getByRole("heading", { name: "Needs you · 8" })).toBeVisible();
  await expect(drawer.getByText(/^Decision \d/)).toHaveCount(5);
  await drawer.getByRole("button", { name: "Show all 8 (3 more)" }).click();
  await expect(drawer.getByText(/^Decision \d/)).toHaveCount(8);
  await expect(drawer.locator("li", { hasText: "Decision 8:" }).first()).toBeFocused();
  await expect(drawer.getByRole("button", { name: /^Show all/ })).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("answering a decision: the recommended choice first, Answered only from the receipt", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const answered: string[] = [];
  const keys: string[] = [];
  await withHive(page, answered);
  await page.route("**/api/rooms/hive-works/actions/answer-decision", async (route) => {
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    expect(route.request().postDataJSON()).toEqual({ need: "decision-1", choice: "Doing" });
    answered.push("decision-1");
    await route.fulfill({
      json: { ok: true, data: { action_id: "answer-decision", ok: true, summary: "Recorded: Doing.", changed: [], at: "2026-09-26T19:44:00Z" } },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Look inside Hive Works" }).click();
  const drawer = page.getByRole("dialog", { name: "Hive Works" });
  const group = drawer.getByRole("group", { name: "Answer “Decision 1: which label for the board column?”" });
  const buttons = group.getByRole("button");
  await expect(buttons).toHaveText(["Doing (recommended)", "In progress", "Started"]);

  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

  await drawer.screenshot({ path: "test-results/hive-works-drawer.png" });
  await buttons.first().click();
  await expect(drawer.getByText("Answered: Doing", { exact: true })).toBeFocused();
  await expect(drawer.getByText("Recorded: Doing.")).toBeVisible();
  expect(keys).toHaveLength(1);
  expect(keys[0]).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("a refused answer says Nothing changed in the room's words", async ({ page }) => {
  await withHive(page, []);
  await page.route("**/api/rooms/hive-works/actions/answer-decision", (route) =>
    route.fulfill({
      json: { ok: true, data: { action_id: "answer-decision", ok: false, summary: "Already decided: Doing.", changed: [], at: null } },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Look inside Hive Works" }).click();
  const drawer = page.getByRole("dialog", { name: "Hive Works" });
  await drawer.getByRole("button", { name: "Doing (recommended)" }).click();
  await expect(drawer.getByRole("alert").filter({ hasText: "Nothing changed" })).toBeFocused();
  await expect(drawer.getByText("Already decided: Doing.")).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("Re-check the tickets: the room's own action, with its receipt in words", async ({ page }) => {
  await withHive(page, []);
  await page.route("**/api/rooms/hive-works/actions/run-freshness", async (route) => {
    expect(route.request().headers()["idempotency-key"]).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
    await route.fulfill({
      json: { ok: true, data: { action_id: "run-freshness", ok: true, summary: "Checked 42 tickets; 3 were out of date.", changed: [], at: "2026-09-26T19:50:00Z" } },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Look inside Hive Works" }).click();
  const drawer = page.getByRole("dialog", { name: "Hive Works" });
  await expect(drawer.getByRole("heading", { name: "Ask Hive Works to" })).toBeVisible();
  // Need-bound actions are never offered here.
  await expect(drawer.getByRole("button", { name: "Answer a decision" })).toHaveCount(0);
  await drawer.getByRole("button", { name: "Re-check the tickets" }).click();
  await expect(drawer.getByRole("status").filter({ hasText: "Checked 42 tickets; 3 were out of date." })).toBeFocused();
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
