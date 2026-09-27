/**
 * Remember, recall and the Later shelf: one tap from every page, "Kept."
 * in plain words, a calm "What did I say about…", and a shelf with at
 * most three in progress that offers a swap instead of refusing. The
 * backend is stood in by routes (made-up words only).
 */
import { test, expect } from "./test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gotoArea } from "./helpers";

const AT = "2026-09-27T09:00:00Z";

async function withMemory(page: Page) {
  const shelf = {
    items: [
      { id: "a1", text: "Paint the shed door", state: "doing", source: "worlds", created: AT },
      { id: "a2", text: "Seed swap list for Jo", state: "doing", source: "worlds", created: AT },
      { id: "a3", text: "Fix the bike light", state: "doing", source: "worlds", created: AT },
      { id: "b1", text: "Moon planting calendar", state: "later", source: "share", created: AT },
      { id: "c1", text: "Frost dates for each bed", state: "done", source: "agent", created: AT, done_at: AT },
    ],
  };
  const kept: { text: string; later?: boolean; source?: string }[] = [];
  const view = () => ({
    in_progress: shelf.items.filter((i) => i.state === "doing"),
    later: shelf.items.filter((i) => i.state === "later"),
    done: shelf.items.filter((i) => i.state === "done"),
    max_in_progress: 3,
  });
  await page.route("**/api/later", (route) => route.fulfill({ json: { ok: true, data: view() } }));
  await page.route("**/api/later/*", async (route) => {
    const id = route.request().url().split("/").pop()!;
    const { to } = route.request().postDataJSON();
    const item = shelf.items.find((i) => i.id === id)!;
    if (to === "doing" && view().in_progress.length >= 3) {
      return route.fulfill({ status: 409, json: { ok: false, error: "Three things are already in progress. Finish or set one back first." } });
    }
    item.state = to;
    return route.fulfill({ json: { ok: true, data: { item, said: { doing: "Started.", done: "Done. Nice.", later: "Back on the Later shelf." }[to as string] } } });
  });
  await page.route("**/api/remember", async (route) => {
    const body = route.request().postDataJSON();
    kept.push(body);
    if (body.later) shelf.items.push({ id: `n${kept.length}`, text: body.text, state: "later", source: body.source ?? "worlds", created: AT });
    return route.fulfill({ json: { ok: true, data: { kept: body.later ? "later" : "journal" } } });
  });
  await page.route("**/api/recall?q=*", (route) => {
    const q = new URL(route.request().url()).searchParams.get("q");
    const results =
      q === "lantern"
        ? [
            { kind: "journal", text: "The lantern opens the hidden door.", when: AT, where: "Journal" },
            { kind: "lore", text: "Sam keeps a spare lantern.", title: "Home", when: AT, where: "Your lore · Home", state: "suggested" },
          ]
        : [];
    return route.fulfill({ json: { ok: true, data: { query: q, results } } });
  });
  return kept;
}

test("Remember is one tap from any page, and says Kept", async ({ page }) => {
  const kept = await withMemory(page);
  await gotoArea(page, "Chat");
  await page.getByRole("button", { name: "Remember" }).click();
  const drawer = page.getByRole("dialog", { name: "Remember" });
  const box = drawer.getByLabel("What do you want to keep?");
  await expect(box).toBeFocused();
  await expect(drawer.getByRole("button", { name: "Keep it" })).toBeDisabled();
  await box.fill("Call Robin about the kiln");
  await drawer.getByRole("button", { name: "Keep it" }).click();
  await expect(drawer.getByRole("status")).toHaveText("Kept. It’s in your journal.");
  await expect(box).toHaveValue("");
  await box.fill("Look up moon gardening");
  await drawer.getByRole("button", { name: "Put it on Later" }).click();
  await expect(drawer.getByRole("status")).toHaveText("Kept. It’s on your Later shelf.");
  expect(kept).toEqual([{ text: "Call Robin about the kiln", later: false }, { text: "Look up moon gardening", later: true }]);
  await page.screenshot({ path: "test-results/remember-1440.png" });
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("the phone's Share sheet offers Remember or Later, and marks where it came from", async ({ page }) => {
  const kept = await withMemory(page);
  await page.goto("/?share_title=Seed%20swap&share_url=https%3A%2F%2Fexample.test%2Fswap");
  await expect(page.getByText("Keep this?")).toBeVisible();
  await page.getByRole("button", { name: "Later", exact: true }).click();
  await expect(page.getByText("Kept on your Later shelf.")).toBeVisible();
  expect(kept[0]).toEqual({ text: "Seed swap\nhttps://example.test/swap", later: true, source: "share" });
  expect(new URL(page.url()).search).toBe("");
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("Memory: recall says where each answer lives; the Later shelf offers a swap", async ({ page }) => {
  await withMemory(page);
  await gotoArea(page, "Memory");
  const main = page.getByRole("main", { name: "Memory" });
  await main.getByRole("searchbox", { name: "What did I say about…" }).fill("lantern");
  await main.getByRole("button", { name: "Find it" }).click();
  await expect(main.getByText("2 things found for “lantern”.")).toBeVisible();
  await expect(main.getByText("The lantern opens the hidden door.")).toBeVisible();
  await expect(main.getByText("Your lore · Home")).toBeVisible();
  await expect(main.getByText(/waiting for you/)).toBeVisible();

  await expect(main.getByText("In progress (3 of 3)")).toBeVisible();
  await expect(main.getByText(/From the Share sheet/)).toBeVisible();
  await main.getByRole("button", { name: "Start this" }).click();
  await expect(main.getByText(/Three things are already in progress. Set one back to start “Moon planting calendar”\?/)).toBeVisible();
  await page.screenshot({ path: "test-results/later-1440.png", fullPage: true });
  let results = await new AxeBuilder({ page }).analyze();
  let bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  await main.getByRole("button", { name: "Set back “Fix the bike light”" }).click();
  await expect(main.getByRole("status").filter({ hasText: "Started." })).toBeVisible();
  await expect(main.getByText("In progress (3 of 3)")).toBeVisible();
  await expect(main.getByRole("listitem").filter({ hasText: "Moon planting calendar" }).getByRole("button", { name: "Done" })).toBeVisible();

  await main.getByRole("listitem").filter({ hasText: "Paint the shed door" }).getByRole("button", { name: "Done" }).click();
  await expect(main.getByRole("status").filter({ hasText: "Done. Nice." })).toBeVisible();
  await expect(main.getByText("Done · 2")).toBeVisible();
  results = await new AxeBuilder({ page }).analyze();
  bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("Memory and Remember fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await withMemory(page);
  await gotoArea(page, "Memory");
  await expect(page.getByText("In progress (3 of 3)")).toBeVisible();
  await page.screenshot({ path: "test-results/later-390.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.getByRole("button", { name: "Remember" }).click();
  await expect(page.getByRole("dialog", { name: "Remember" })).toBeVisible();
  await page.screenshot({ path: "test-results/remember-390.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
