/**
 * Computers: a calm map of what you have, from the Engine room's estate
 * view. Status in words ("not checked" and "reachable" never look healthy),
 * new things glow and ask what they're for, gone things fade, and an Engine
 * room that isn't answering shows nothing as current. Made-up names only.
 */
import { test, expect } from "./test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gotoArea } from "./helpers";

const ESTATE = {
  machines: [
    { name: "big-host", what: "The big box that holds the others", kind: "host", status: "running", drift: null },
    { name: "media-vm", what: "Shows, movies and music", kind: "vm", status: "running", drift: null },
    { name: "notes-box", what: "Kit's notes", kind: "container", status: "stopped", drift: null },
    { name: "mystery-vm", what: "", kind: "vm", status: "running", drift: "new" },
    { name: "workbench", what: "Sam's workstation", kind: "machine", status: "reachable", drift: null },
    { name: "old-nas", what: "Old storage", kind: "machine", status: "not checked", drift: "gone?" },
  ],
  machines_source: "proxmox",
  groups: [{ name: "Your shows, movies, music", what: "The household's media", services: ["Shelf", "Player"], drift: null }],
  rooms: [{ id: "hive-works", name: "Hive Works" }, { id: "somewhere", name: "Somewhere new" }],
  projects: [{ id: "garden", name: "Garden planner", what: "Frost dates and beds" }],
  devices: [{ name: "Jo's phone", status: "connected", last_seen: null }, { name: "Alex's laptop", status: "never", last_seen: null }],
  devices_source: "vpn",
  drift: null,
};

async function withEstate(page: Page, reachable = true) {
  await page.route("**/api/rooms", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const studio = body.data.find((r: { id: string }) => r.id === "studio");
    body.data.push({
      ...studio, id: "engine-room", reachable, status: reachable ? "healthy" : "unreachable",
      room: { ...studio.room, id: "engine-room", name: "Engine room" }, needs_you: [], cards: [], keeper: null, doorway: null, actions: [],
    });
    await route.fulfill({ response, json: body });
  });
  await page.route("**/api/rooms/engine-room/views/estate", (route) =>
    route.fulfill({ json: { ok: true, data: { ...ESTATE, generated_at: new Date(Date.now() - 3 * 60_000).toISOString() } } }),
  );
}

test("Computers: machines as places, the host holds its guests, status in words", async ({ page }) => {
  await withEstate(page);
  await gotoArea(page, "Computers");
  const main = page.getByRole("main", { name: "Computers" });
  await expect(main.getByRole("heading", { level: 1, name: "Computers" })).toBeVisible();
  await expect(main.getByText(/^Checked /)).toBeVisible();
  const inside = main.getByRole("list", { name: "Inside big-host" });
  await expect(inside.getByRole("heading", { name: "media-vm" })).toBeVisible();
  await expect(inside.getByRole("heading", { name: "notes-box" })).toBeVisible();
  await expect(main.getByText("Reachable (not checked inside)")).toBeVisible();
  await expect(main.getByText("Not checked", { exact: true })).toBeVisible();
  await expect(main.getByText("Something new. What’s it for?")).toBeVisible();
  await expect(main.getByText("This seems gone. It may be archived.")).toBeVisible();
  await expect(main.getByText("1 new thing to say what it’s for · 1 that seems gone")).toBeVisible();
  await expect(main.getByText("Never connected")).toBeVisible();
  await expect(main.getByText("Somewhere new")).toBeVisible();
  await expect(main.getByText("Garden planner")).toBeVisible();
  await main.getByText("2 services").click();
  await expect(main.getByText("Shelf, Player")).toBeVisible();
  await page.screenshot({ path: "test-results/computers-1440.png", fullPage: true });
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("Computers fits a phone, and says so when the Engine room isn't answering", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await withEstate(page);
  await gotoArea(page, "Computers");
  await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible();
  await page.screenshot({ path: "test-results/computers-390.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await withEstate(page, false);
  await page.goto("/");
  await gotoArea(page, "Computers");
  await expect(page.getByText(/can’t reach the Engine room right now/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Machines" })).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
