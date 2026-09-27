/**
 * At home: the household's shows, movies and music from the Engine room.
 * Search, genre, "new on the shelf", a kind that can't be read says so,
 * and an Engine room that isn't answering shows nothing as current.
 * Made-up titles only.
 */
import { test, expect } from "./test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gotoArea } from "./helpers";

const AT = "2026-09-27T09:00:00Z";
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.parse(AT) - days * DAY).toISOString();

const SHOWS = Array.from({ length: 60 }, (_, i) => ({
  title: `Lantern Street ${String(i + 1).padStart(2, "0")}`,
  year: 2000 + (i % 25),
  status: i % 3 === 0 ? "continuing" : "ended",
  network: "Kit TV",
  genres: i % 2 ? ["Drama"] : ["Comedy", "Family"],
  monitored: true,
  added: ago(i + 2),
  episodes_have: 10,
  episodes_total: i % 4 === 0 ? 12 : 10,
}));
SHOWS.push({ title: "The Moon Gardeners", year: 2026, status: "continuing", network: "Kit TV", genres: ["Family"], monitored: true, added: ago(0.5), episodes_have: 3, episodes_total: 8 });

async function withHome(page: Page, reachable = true, musicOk = true) {
  await page.route("**/api/rooms", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const studio = body.data.find((r: { id: string }) => r.id === "studio");
    body.data.push({
      ...studio,
      id: "engine-room",
      reachable,
      status: reachable ? "healthy" : "unreachable",
      room: { ...studio.room, id: "engine-room", name: "Engine room" },
      needs_you: [],
      cards: [],
      keeper: null,
      doorway: null,
      actions: [],
    });
    await route.fulfill({ response, json: body });
  });
  const view = (json: unknown) => (route: import("@playwright/test").Route) => route.fulfill({ json: { ok: true, data: json } });
  await page.route("**/api/rooms/engine-room/views/media", view({
    generated_at: AT,
    scope: "household",
    kinds: {
      shows: { ok: true, count: SHOWS.length },
      movies: { ok: true, count: 2 },
      music: musicOk ? { ok: true, count: 1 } : { ok: false, error: "The music server didn't answer." },
    },
  }));
  await page.route("**/api/rooms/engine-room/views/media/shows", view({ ok: true, count: SHOWS.length, items: SHOWS }));
  await page.route("**/api/rooms/engine-room/views/media/music", view({
    ok: true,
    count: 1,
    items: [{ artist: "The Kiln Band", genres: ["Folk"], added: ago(3), monitored: true, albums: 2 }],
  }));
  await page.route("**/api/rooms/engine-room/views/media/movies", view({
    ok: true,
    count: 2,
    items: [
      { title: "Robin and the Kiln", year: 2019, genres: ["Drama"], have: true, studio: "Alex Films", added: ago(4), monitored: true },
      { title: "Seed Swap", year: 2027, genres: ["Comedy"], have: false, studio: "Jo Pictures", added: ago(1), monitored: true },
    ],
  }));
}

test("At home: the household's shelves, searchable, with what's new", async ({ page }) => {
  await withHome(page);
  await gotoArea(page, "Interests");
  await page.getByRole("button", { name: "See what’s at home" }).click();
  const main = page.getByRole("main", { name: "At home" });
  await expect(main.getByRole("heading", { level: 1, name: "At home" })).toBeVisible();
  await expect(main.getByText(/for everyone in the house/)).toBeVisible();
  await expect(main.getByRole("button", { name: "Shows · 61" })).toHaveAttribute("aria-pressed", "true");
  await expect(main.getByRole("heading", { name: "New on the shelf" })).toBeVisible();
  await expect(main.locator(".home-grid").first().locator("li").first()).toContainText("The Moon Gardeners");
  await expect(main.getByText("3 of 8 episodes · still airing").first()).toBeVisible();
  // 48 at a time.
  await expect(main.locator(".home-grid").nth(1).locator("li")).toHaveCount(48);
  await main.getByRole("button", { name: "Show 13 more (13 left)" }).click();
  await expect(main.locator(".home-grid").nth(1).locator("li")).toHaveCount(61);
  await page.screenshot({ path: "test-results/at-home-1440.png", fullPage: true });
  let results = await new AxeBuilder({ page }).analyze();
  let bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);

  await main.getByLabel("Find a show").fill("moon");
  await expect(main.getByText("1 of 61 shows")).toBeVisible();
  await main.getByLabel("Find a show").fill("");
  await main.getByLabel("Genre").selectOption("Drama");
  await expect(main.getByText("30 of 61 shows")).toBeVisible();

  await main.getByRole("button", { name: "Movies · 2" }).click();
  await expect(main.getByText("Wanted, not here yet · Jo Pictures").first()).toBeVisible();
  await expect(main.getByText("On the shelf · Alex Films").first()).toBeVisible();

  await main.getByRole("button", { name: "Music · 1" }).click();
  await expect(main.getByText("2 albums").first()).toBeVisible();
  results = await new AxeBuilder({ page }).analyze();
  bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);

  await main.getByRole("button", { name: "Back to Interests" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Interests" })).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("a kind that can't be read says so, in its own words", async ({ page }) => {
  await withHome(page, true, false);
  await gotoArea(page, "Interests");
  await page.getByRole("button", { name: "See what’s at home" }).click();
  const main = page.getByRole("main", { name: "At home" });
  await main.getByRole("button", { name: "Music · can’t read" }).click();
  await expect(main.getByText("Couldn’t read the artists just now. The music server didn't answer. Nothing here is current until it answers.")).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("when the Engine room isn't answering, nothing is shown as current; it fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await withHome(page, false);
  await gotoArea(page, "Interests");
  await page.getByRole("button", { name: "See what’s at home" }).click();
  await expect(page.getByText(/can’t reach the Engine room right now/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Shows/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  // And the shelves themselves fit a phone.
  await withHome(page, true);
  await page.goto("/");
  await gotoArea(page, "Interests");
  await page.getByRole("button", { name: "See what’s at home" }).click();
  await expect(page.getByRole("heading", { name: "New on the shelf" })).toBeVisible();
  await page.screenshot({ path: "test-results/at-home-390.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
