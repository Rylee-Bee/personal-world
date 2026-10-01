import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SHOTS = process.env.PW_FD_SHOTS;

test("Home against the real reference provider", async ({ page }, info) => {
  await page.goto("/#home");
  await page.getByRole("heading", { name: "Needs a look" }).waitFor();

  // unavailable, degraded, locked all land in Needs a look, worst first
  const look = page.getByRole("heading", { name: "Needs a look" }).locator("xpath=ancestor::section");
  const names = await look.getByRole("listitem").locator("button").allTextContents();
  const order = ["Reference down", "Reference bad data", "Reference locked"].map((n) => names.findIndex((t) => t.includes(n)));
  expect(order.every((i) => i >= 0), JSON.stringify(names)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));

  // healthy rows are quiet; the empty list is healthy, not unavailable
  const quiet = page.getByRole("heading", { name: "Quietly working" }).locator("xpath=ancestor::section");
  await expect(quiet).toContainText("Reference empty");
  await expect(quiet).toContainText("none");
  await expect(quiet).toContainText("Healthy");

  // a missing value is a dash, never 0
  await expect(look.getByText("0", { exact: true })).toHaveCount(0);

  // drill-in shows evidence for the failing source
  await look.getByRole("button", { name: /Reference down/ }).click();
  const region = page.getByRole("region", { name: "Reference down details" });
  await region.getByText("Technical evidence").click();
  await expect(region).toContainText("http_5xx");

  const violations = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations;
  expect(violations.map((v) => v.id)).toEqual([]);
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(o.sw).toBeLessThanOrEqual(o.cw);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/live-${info.project.name}-home.png`, fullPage: true });
});
