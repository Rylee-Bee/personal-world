/**
 * Projects: the Hive Works company inside Worlds. Teams filter the
 * projects, a project opens its tickets (focus moves to its name), the
 * bees are shown by name, links open on the Hive Works site, and a
 * Hive Works that isn't connected says so. Made-up data only.
 */
import { test, expect } from "./test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gotoArea } from "./helpers";

const AT = "2026-09-27T09:00:00Z";
const TEAMS = {
  generated_at: AT,
  teams: [
    { id: "team-build", name: "Builders", bee: "bumble", projects: ["proj-garden", "proj-kiln"], open: 9, asks_you: 2 },
    { id: "team-words", name: "Wordsmiths", bee: "clover", projects: ["proj-letters"], open: 3, asks_you: 0 },
  ],
};
const PROJECTS = {
  generated_at: AT,
  projects: [
    { id: "proj-garden", name: "Garden planner", team: "team-build", open: 6, decisions_open: 2, closed: 41, stale: 1, link: "/projects/proj-garden", status_line: "6 open · 2 to re-check · 1 shipped this week", closed_this_week: 1, last_shipped: { hw: "HW-9", what: "Bed labels", at: "2026-09-26T09:00:00Z" } },
    { id: "proj-kiln", name: "Kiln timer", team: "team-build", open: 3, decisions_open: 0, closed: 12, stale: 0, link: "/projects/proj-kiln" },
    { id: "proj-letters", name: "Letters to Jo", team: "team-words", open: 3, decisions_open: 0, closed: 7, stale: 0, link: "/projects/proj-letters" },
  ],
};
const GARDEN = {
  generated_at: AT,
  project: {
    ...PROJECTS.projects[0],
    tickets: [
      { hw: "HW-12", what: "Frost dates for each bed", stage: "building", status: "backlog", freedom: "decide it", done_when: "Each bed shows its last frost date", owner: "Bumble", link: "/tickets/HW-12" },
      { hw: "HW-19", what: "Seed swap list", stage: "idea", status: "someday", freedom: "ask first", done_when: "Sam can print it", owner: "Clover", link: null },
    ],
    closed_tickets: [
      { hw: "HW-9", what: "Bed labels", status: "closed", closed_at: "2026-09-26T09:00:00Z", link: "/tickets/HW-9" },
      { hw: "HW-4", what: "Moon planting calendar", status: "dropped", closed_at: "2026-09-20T09:00:00Z", link: null },
    ],
  },
};
const CREW = {
  generated_at: AT,
  crew: [
    { bee: "bumble", name: "Bumble", job: "Lead builder", line: "Measure twice, buzz once.", face_url: null },
    { bee: "clover", name: "Clover", job: "Words and letters", line: "Every ticket deserves a good first line.", face_url: null },
  ],
};

async function withHive(page: Page, reachable = true, actions: unknown[] = []) {
  await page.route("**/api/rooms", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const studio = body.data.find((r: { id: string }) => r.id === "studio");
    body.data.push({
      ...studio,
      id: "hive-works",
      base_url: "http://127.0.0.1:8950",
      public_url: "https://hive.example.test",
      reachable,
      status: reachable ? "healthy" : "unreachable",
      room: { ...studio.room, id: "hive-works", name: "Hive Works", icon: "hexagon" },
      needs_you: [
        { id: "decision-1", title: "Which frost source?", why: "Recommended: the local one.", actions: ["answer-decision"], created_at: AT, choices: ["Local", "National"] },
      ],
      cards: [],
      keeper: null,
      doorway: null,
      actions,
    });
    await route.fulfill({ response, json: body });
  });
  const view = (json: unknown) => async (route: import("@playwright/test").Route) =>
    route.fulfill({ json: { ok: true, data: json } });
  await page.route("**/api/rooms/hive-works/views/teams", view(TEAMS));
  await page.route("**/api/rooms/hive-works/views/projects", view(PROJECTS));
  await page.route("**/api/rooms/hive-works/views/projects/proj-garden", view(GARDEN));
  await page.route("**/api/rooms/hive-works/views/crew", view(CREW));
}

test("Projects shows Hive Works: teams filter, tickets, bees, links on its site", async ({ page }) => {
  await withHive(page);
  await gotoArea(page, "Projects");
  const main = page.getByRole("main", { name: "Projects" });
  await expect(main.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  await expect(main.getByText("Hive Works needs you for 1 thing.")).toBeVisible();
  await expect(main.getByRole("heading", { name: "Projects · 3" })).toBeVisible();
  await expect(main.getByText("Measure twice, buzz once.", { exact: false })).toBeVisible();
  await expect(main.getByRole("link", { name: /Open in Hive Works/ }).first()).toHaveAttribute(
    "href",
    "https://hive.example.test/projects/proj-garden",
  );
  await page.screenshot({ path: "test-results/projects-1440.png", fullPage: true });

  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);

  await main.getByRole("button", { name: /Wordsmiths/ }).click();
  await expect(main.getByRole("heading", { name: "Projects · 1" })).toBeVisible();
  await main.getByRole("button", { name: "All teams" }).click();

  await main.getByRole("button", { name: "See the tickets for Garden planner" }).click();
  await expect(main.getByRole("heading", { level: 2, name: "Garden planner" })).toBeFocused();
  await expect(main.getByRole("heading", { name: "Backlog · 1" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Someday · 1" })).toBeVisible();
  await expect(main.getByText("Done when: Each bed shows its last frost date")).toBeVisible();
  await main.getByRole("button", { name: "All projects" }).click();
  await expect(main.getByRole("heading", { name: "Projects · 3" })).toBeVisible();

  // Deciding stays in the drawer.
  await main.getByRole("button", { name: "Look inside Hive Works" }).click();
  await expect(page.getByRole("dialog", { name: "Hive Works" })).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("a project says what shipped, and dropped work never counts as shipped", async ({ page }) => {
  await withHive(page);
  await gotoArea(page, "Projects");
  const main = page.getByRole("main", { name: "Projects" });
  // Hive Works' own status line, shown as is; our counts for the rest.
  await expect(main.getByText("6 open · 2 to re-check · 1 shipped this week")).toBeVisible();
  await expect(main.getByText("3 open tickets", { exact: false }).first()).toBeVisible();
  await expect(main.getByText(/1 ticket closed this week · Last shipped: Bed labels \(HW-9\)/).first()).toBeVisible();

  await main.getByRole("button", { name: "See the tickets for Garden planner" }).click();
  const closed = main.getByText("Closed · 2");
  await expect(closed).toBeVisible();
  await expect(main.getByText("1 shipped · 1 dropped")).toBeVisible();
  await expect(main.getByText("Moon planting calendar")).toBeHidden();
  await closed.click();
  await expect(main.getByText("Moon planting calendar")).toBeVisible();
  await expect(main.getByText(/^Dropped: won’t be done/)).toBeVisible();
  await expect(main.getByText(/^Shipped · /)).toBeVisible();
  await page.screenshot({ path: "test-results/projects-closed-1440.png", fullPage: true });
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("Projects fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await withHive(page);
  await gotoArea(page, "Projects");
  await expect(page.getByRole("heading", { name: "Projects · 3" })).toBeVisible();
  await page.screenshot({ path: "test-results/projects-390.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("when Hive Works isn't answering, nothing is shown as current", async ({ page }) => {
  await withHive(page, false);
  await gotoArea(page, "Projects");
  await expect(page.getByText(/can’t reach Hive Works right now/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Projects ·/ })).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("Riff: each bee choice shows that bee's face from Hive Works", async ({ page }) => {
  await withHive(page, true, [
    {
      id: "riff",
      title: "Riff",
      writes: true,
      fields: [
        { name: "words", kind: "text", label: "What's on your mind", required: true, max_length: 500 },
        { name: "bees", kind: "choices", label: "Who joins", required: false, max: 4, options: [
          { value: "bumble", label: "Bumble" },
          { value: "clover", label: "Clover" },
        ] },
      ],
    },
  ]);
  const faces = {
    ...CREW,
    crew: CREW.crew.map((b) => ({ ...b, face_file: `art/crew/${b.bee}.webp`, face_url: `/art/crew/${b.bee}.webp` })),
  };
  await page.route("**/api/rooms/hive-works/views/crew", (route) => route.fulfill({ json: { ok: true, data: faces } }));
  // A tiny stand-in picture for the Hive Works site.
  // Faces come through Worlds (no Hive Works sign-in needed).
  await page.route("**/api/rooms/hive-works/art/*.webp", (route) =>
    route.fulfill({ path: "public/assets/crew/256/bolt-sleepy.webp", contentType: "image/webp" }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Look inside Hive Works" }).click();
  const drawer = page.getByRole("dialog", { name: "Hive Works" });
  await drawer.getByRole("button", { name: "Riff" }).click();
  const bumble = drawer.getByRole("button", { name: "Bumble" });
  await expect(bumble.locator("img")).toHaveAttribute("src", "/api/rooms/hive-works/art/bumble.webp");
  await expect(bumble.locator("img")).toHaveAttribute("alt", "");
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

