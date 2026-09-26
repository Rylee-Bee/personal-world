/**
 * Daylight (the light pack, owner-approved 2026-09-26): every main
 * screen passes axe with colour contrast on, like the dark packs.
 */
import { test, expect } from "./test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ request }) => { await request.delete("/api/__test/reset"); });
for (const [area, extra] of [["Bridge", null], ["Bridge", "Look inside Workshop"], ["Memory", null], ["Chat", null], ["Settings", null]] as const) {
  test("daylight " + area + (extra ?? ""), async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("pw-station-theme", "daylight"));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.getByRole("navigation", { name: "World navigation" }).getByRole("button", { name: area }).click();
    if (extra) await page.getByRole("button", { name: extra }).click();
    await page.waitForTimeout(300);
    const r = await new AxeBuilder({ page }).analyze();
    const bad = r.violations.filter(v => v.impact === "serious" || v.impact === "critical");
    expect(bad.map(v => v.id + ": " + v.nodes.slice(0,3).map(n => n.target.join(" ")).join(" | "))).toEqual([]);
  });
}
