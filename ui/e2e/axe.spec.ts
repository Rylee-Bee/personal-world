/**
 * axe gates — the interface's automated accessibility floor.
 *
 * Ported from the retired frontend/ suite when the rebuild became the
 * only interface (owner decision 2026-09-22): the coverage was real even
 * though the implementation it tested was not. Full default rule set,
 * NO .disableRules() anywhere — a suppressed rule is a hidden failure.
 * Zero serious/critical violations per landmark view.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gotoArea } from "./helpers";

const VIEWS = ["Overview", "Memory", "Chat", "Settings"] as const;

for (const view of VIEWS) {
  test(`axe ${view}: 0 serious/critical`, async ({ page }) => {
    await gotoArea(page, view);
    const results = await new AxeBuilder({ page }).analyze();
    const bad = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`),
      `axe violations on ${view}`,
    ).toEqual([]);
  });
}
