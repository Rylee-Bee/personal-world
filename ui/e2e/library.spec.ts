/**
 * The Library: Worlds' own storybooks, plus shelves lent by rooms (a
 * Hive Works handbook, a VEFR study), each under its keeper's name and
 * never merged, gathered through GET /api/library. A book opens with one
 * press (focus to its title), the technical page is folded away, drafts
 * sit apart and folded, a glossary word can be tapped, and a library
 * that can't be read says so. Made-up rooms and books only.
 */
import { test, expect } from "./test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gotoArea } from "./helpers";

const AT = "2026-09-27T09:00:00Z";

const HIVE_LIBRARY = {
  contract: "library/0",
  generated_at: AT,
  keeper: { id: "hive-works", name: "Hive Works", look: "hive-corporate" },
  shelves: [
    { id: "how", name: "How the hive runs" },
    { id: "worlds", name: "Worlds, as the hive sees it" },
    { id: "drafts", name: "New, read when you're ready" },
  ],
  glossary: { brainstorm: { plain: "Thinking out loud together, where no idea is wrong yet.", local: "a riff" } },
  books: [
    {
      id: "riff",
      shelf: "how",
      title: "Riffing",
      short: "You think out loud and the bees add to it.",
      link: "/library/riff",
      pages: [
        { kind: "plain", text: "Say an idea in a line. Up to four bees answer with theirs. It's a *brainstorm*, not a vote." },
        { kind: "voice", voice: "Bumble", text: "Best part of my day, honestly." },
        { kind: "words", text: "- **Brainstorm:** thinking out loud together." },
        { kind: "technical", text: "`POST /room/actions/riff`" },
      ],
    },
    {
      id: "rooms-hive",
      shelf: "worlds",
      title: "Rooms",
      short: "Worlds shows the hive as a room, and never copies it.",
      pages: [{ kind: "plain", text: "The hive keeps its own house; Worlds just has a door to it." }],
    },
    {
      id: "draft-queue",
      shelf: "drafts",
      title: "How the queue moves",
      short: "Tickets wait their turn, and a bee picks the next one.",
      pages: [{ kind: "plain", text: "A draft, not kept yet." }],
    },
  ],
};

const VEFR_LIBRARY = {
  contract: "library/0",
  generated_at: AT,
  keeper: { id: "vefr", name: "VEFR", look: "vefr" },
  shelves: [{ id: "tales", name: "How stories are told" }],
  books: [
    {
      id: "scenes",
      shelf: "tales",
      title: "Scenes and beats",
      short: "A story is a string of small scenes, each with one turn.",
      pages: [{ kind: "plain", text: "Every scene changes one thing." }],
    },
  ],
};

async function withLibraries(page: Page, hiveReachable = true) {
  await page.route("**/api/rooms", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const studio = body.data.find((r: { id: string }) => r.id === "studio");
    const room = (id: string, name: string, reachable: boolean) => ({
      ...studio,
      id,
      base_url: "http://127.0.0.1:8950",
      public_url: `https://${id}.example.test`,
      reachable,
      status: reachable ? "healthy" : "unreachable",
      room: { ...studio.room, id, name },
      needs_you: [],
      cards: [],
      keeper: null,
      doorway: null,
      actions: [],
    });
    body.data.push(room("hive-works", "Hive Works", hiveReachable), room("vefr", "VEFR", true));
    await route.fulfill({ response, json: body });
  });
  const view = (json: unknown) => async (route: import("@playwright/test").Route) =>
    route.fulfill({ json: { ok: true, data: json } });
  await page.route("**/api/library", view([
    hiveReachable
      ? { room: "hive-works", status: "ok", library: HIVE_LIBRARY }
      : { room: "hive-works", status: "unavailable", error: "It didn’t answer." },
    { room: "vefr", status: "ok", library: VEFR_LIBRARY },
  ]));
  await page.route("**/api/rooms/hive-works/views/crew", view({ generated_at: AT, crew: [] }));
}

async function openLibrary(page: Page) {
  await gotoArea(page, "Settings");
  await page.getByRole("button", { name: "Open the Library" }).click();
  return page.getByRole("main", { name: "Library" });
}

test("Library: every keeper's shelves under its own name, a book opens with one press", async ({ page }) => {
  await withLibraries(page);
  const main = await openLibrary(page);
  await expect(main.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Worlds’ own books" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "From Hive Works" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "From VEFR" })).toBeVisible();
  // The same topic sits on two keepers' shelves, never merged.
  await expect(main.getByRole("button", { name: "Open Rooms" })).toHaveCount(2);
  await expect(main.getByRole("navigation", { name: "Whose shelves" })).toContainText("Hive Works · 2");
  await expect(main.getByRole("button", { name: "Open How the interface was made" })).toBeVisible();
  await expect(main.getByText("By Bumble")).toBeVisible();
  // Worlds' painted covers and shelf headers.
  await expect(main.locator('img[src$="covers/256/02-rooms.webp"]')).toHaveCount(1);
  await expect(main.locator('img[src$="shelf-hive-corporate.webp"]')).toHaveCount(1);
  // Drafts sit apart, folded, and aren't counted as kept books.
  await expect(main.getByText("2 books · 1 new draft")).toBeVisible();
  await expect(main.getByRole("button", { name: "Open How the queue moves" })).toBeHidden();
  await main.getByText("New, read when you're ready · 1").click();
  await expect(main.getByRole("button", { name: "Open How the queue moves" })).toBeVisible();
  await page.screenshot({ path: "test-results/library-1440.png", fullPage: true });
  let results = await new AxeBuilder({ page }).analyze();
  let bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);

  // Open a Worlds book: short first, pages, words, and Under the hood folded.
  await main.getByRole("button", { name: "Open How the interface was made" }).click();
  await expect(main.getByRole("heading", { level: 2, name: "How the interface was made" })).toBeFocused();
  await expect(main.getByRole("heading", { name: "In Claude’s words" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Words to know" })).toBeVisible();
  const hood = main.locator("details", { hasText: "Under the hood" });
  await expect(hood).not.toHaveAttribute("open", "");
  await expect(hood.getByText("design/tokens.json")).toBeHidden();
  await hood.locator("summary").click();
  await expect(hood.getByText("design/tokens.json")).toBeVisible();
  await page.screenshot({ path: "test-results/library-book-1440.png", fullPage: true });
  results = await new AxeBuilder({ page }).analyze();
  bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);

  await main.getByRole("button", { name: "Previous: Making the UI" }).click();
  await expect(main.getByRole("heading", { level: 2, name: "Making the UI" })).toBeFocused();

  // Back to the shelves: focus returns to the book.
  await main.getByRole("button", { name: "Back to the shelves" }).click();
  await expect(main.getByRole("button", { name: "Open Making the UI" })).toBeFocused();

  // A room's book: the keeper's voice with its speaker, and a link to its site.
  await main.getByRole("button", { name: "Open Riffing" }).click();
  await expect(main.getByText("Hive Works · How the hive runs")).toBeVisible();
  await expect(main.getByRole("heading", { name: "In Bumble’s words" })).toBeVisible();
  // Tap to learn: the card shows only when asked, and Got it returns focus.
  const term = main.getByRole("button", { name: "brainstorm" });
  await term.click();
  await expect(main.getByRole("status").filter({ hasText: "In Hive Works: a riff" })).toBeVisible();
  await page.screenshot({ path: "test-results/library-term-1440.png", fullPage: true });
  await main.getByRole("button", { name: "Got it" }).click();
  await expect(term).toBeFocused();
  await expect(main.getByRole("link", { name: /Read it on Hive Works’s site/ })).toHaveAttribute(
    "href",
    "https://hive-works.example.test/library/riff",
  );
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("Library fits a phone, and a book reads well there", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await withLibraries(page);
  const main = await openLibrary(page);
  await expect(main.getByRole("heading", { name: "From Hive Works" })).toBeVisible();
  await page.screenshot({ path: "test-results/library-390.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await main.getByRole("button", { name: "Open How Worlds fits together" }).click();
  await expect(main.getByRole("heading", { level: 2, name: "How Worlds fits together" })).toBeFocused();
  await page.screenshot({ path: "test-results/library-book-390.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("a library that can't be read says so, and Worlds' own books still show", async ({ page }) => {
  await withLibraries(page, false);
  const main = await openLibrary(page);
  await expect(main.getByText(/Couldn’t read Hive Works’s library just now. It didn’t answer./)).toBeVisible();
  await expect(main.getByRole("button", { name: "Open Rooms" })).toHaveCount(1);
  await expect(main.getByRole("heading", { name: "From VEFR" })).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
