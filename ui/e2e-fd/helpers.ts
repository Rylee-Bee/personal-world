import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { cards, homeBoard, needsYou } from "../src/fd/fixtures";
import type { CardEnvelope } from "../src/fd/types";

export type Scenario = "mixed" | "healthy" | "board-error";

export async function mockApi(page: Page, scenario: Scenario = "mixed") {
  const healthy = (c: CardEnvelope): CardEnvelope => ({ ...c, source_state: c.source_state === "not_configured" ? c.source_state : "healthy", freshness: "current", evidence: { ...c.evidence, error_class: undefined, status_code: 200 }, ...(c.card_id === "malformed" ? { values: { count: { text: "3", raw: 3 } } } : {}) });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (scenario === "board-error" && url.pathname === "/api/boards/home") return json({ detail: "down" }, 500);
    if (url.pathname === "/api/boards/home") return json(homeBoard);
    if (url.pathname === "/api/needs-you") return json(scenario === "healthy" ? [] : needsYou);
    const m = url.pathname.match(/^\/api\/cards\/(.+)$/);
    if (m && cards[m[1]]) return json(scenario === "healthy" ? healthy(cards[m[1]]) : cards[m[1]]);
    return json({ detail: "not found" }, 404);
  });
}

export async function open(page: Page, hash = "#home", scenario: Scenario = "mixed") {
  await mockApi(page, scenario);
  await page.goto(`/${hash}`);
  await expect(page.getByRole("main")).toBeVisible();
  if (hash === "#home" && scenario !== "board-error") {
    await page.getByRole("heading", { name: "Needs a look" }).waitFor();
    await expect(page.getByRole("status")).toHaveCount(0);
  }
}

export async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

export async function noHorizontalOverflow(page: Page) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(o.sw, `scrollWidth ${o.sw} > clientWidth ${o.cw}`).toBeLessThanOrEqual(o.cw);
}
