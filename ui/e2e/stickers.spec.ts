/**
 * The Sticker Album (#stickers): Worlds' sections and each app's page,
 * counts in words ("… · and some secrets"), riddles as striped blanks with
 * their riddle on the back, a found sticker's back with where it was found,
 * moving a sticker without a mouse, and dragging one. Made-up stickers only.
 */
import { test, expect } from "./test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const AT = "2026-09-27T09:00:00Z";
const ALBUM = {
  pages: [
    {
      app: "worlds",
      title: "Worlds",
      look: "scifi-storybook",
      found: 2,
      shown: 4,
      secrets_remain: true,
      stickers: [
        { id: "first-light", kind: "open", shine: "paper", shape: "circle", section: "First steps", found: true, name: "First Light", art: "/assets/stickers/first-light.webp", earn: "Open Worlds for the very first time.", found_at: AT, context: "on the Bridge", placed: null },
        { id: "hello-crew", kind: "open", shine: "paper", shape: "star", section: "First steps", found: false, name: "Hello, Crew", art: "/assets/stickers/hello-crew.webp", earn: "Choose your companion." },
        { id: "pocket", kind: "riddle", shine: "paper", shape: "circle", section: "First steps", found: false, riddle: "Worlds fits in a place you carry everywhere." },
        { id: "bookworm", kind: "open", shine: "foil", shape: "book", section: "Library", found: true, name: "Bookworm", art: "/assets/stickers/bookworm.webp", earn: "Open a book in the Library.", found_at: AT, placed: { x: 0.3, y: 0.5, r: 4 } },
      ],
    },
    {
      app: "hive-works",
      title: "Hive Works",
      look: "hive-corporate",
      found: 0,
      shown: 1,
      secrets_remain: false,
      stickers: [{ id: "honey-handshake", kind: "open", shine: "paper", shape: "circle", found: false, name: "Honey Handshake", art: "stickers-honey", earn: "Answer your first decision." }],
    },
  ],
  unavailable: [],
  total_found: 2,
};

async function withAlbum(page: Page) {
  const placed: unknown[] = [];
  await page.route("**/api/stickers", (route) => route.fulfill({ json: { ok: true, data: ALBUM } }));
  await page.route("**/api/stickers/place", (route) => {
    placed.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true, data: { placed: {} } } });
  });
  return placed;
}

test("the album: pages, counts in words, riddles, a found sticker's back, moving without a mouse", async ({ page }) => {
  const placed = await withAlbum(page);
  await page.goto("/#stickers");
  const main = page.getByRole("main", { name: "Sticker album" });
  await expect(main.getByRole("heading", { level: 1, name: "Sticker album" })).toBeVisible();
  await expect(main.getByRole("button", { name: "First steps" })).toHaveAttribute("aria-pressed", "true");
  await expect(main.getByText("1 of 3 found · and some secrets")).toBeVisible();
  // The riddle keeps its name hidden; its back shows the riddle.
  await main.getByRole("button", { name: "A riddle. Turn it over." }).click();
  await expect(main.getByText("“Worlds fits in a place you carry everywhere.”")).toBeVisible();
  await expect(main.getByText("Pocket")).toHaveCount(0);
  // A found sticker's back: how it was earned, and where.
  await main.getByRole("button", { name: "First Light, found. Turn it over." }).click();
  await expect(main.getByText("Open Worlds for the very first time.")).toBeVisible();
  await expect(main.getByText(/on the Bridge/)).toBeVisible();
  await expect(main.getByText("New").first()).toBeVisible();
  await page.screenshot({ path: "test-results/stickers-1440.png", fullPage: true });
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  // Moving without a mouse.
  await main.getByRole("button", { name: "Move right" }).click();
  await main.getByRole("button", { name: "Tilt left" }).click();
  expect(placed.length).toBe(2);
  expect(placed[1]).toMatchObject({ app: "worlds", sticker: "first-light" });
  // Another app's page, in its own look, with its art through the room.
  await main.getByRole("button", { name: "Hive Works" }).click();
  await expect(main.getByText("0 of 1 found")).toBeVisible();
  await expect(page.locator(".sticker-look-hive-corporate")).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("a found sticker can be dragged somewhere else on the page", async ({ page }) => {
  const placed = await withAlbum(page);
  await page.goto("/#stickers");
  await page.getByRole("button", { name: "Library" }).click();
  const slot = page.locator(".sticker-slot").first();
  const box = (await slot.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 10, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => placed.length).toBe(1);
  expect(placed[0]).toMatchObject({ app: "worlds", sticker: "bookworm" });
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("the album fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await withAlbum(page);
  await page.goto("/#stickers");
  await expect(page.getByText("1 of 3 found · and some secrets")).toBeVisible();
  await page.screenshot({ path: "test-results/stickers-390.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
