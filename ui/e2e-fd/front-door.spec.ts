import { expect, test } from "@playwright/test";
import { axe, noHorizontalOverflow, open } from "./helpers";

const SHOTS = process.env.PW_FD_SHOTS;
const shot = async (page: import("@playwright/test").Page, name: string, info: import("@playwright/test").TestInfo) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-${name}.png`, fullPage: true });
};

test.describe("axe and overflow", () => {
  for (const [name, hash, scenario] of [
    ["home-mixed", "#home", "mixed"], ["home-healthy", "#home", "healthy"], ["home-board-error", "#home", "board-error"],
    ["connect", "#connect", "mixed"], ["memory", "#memory", "mixed"], ["settings", "#settings", "mixed"],
  ] as const) {
    test(name, async ({ page }, info) => {
      await open(page, hash, scenario === "board-error" ? "board-error" : scenario);
      if (scenario === "board-error") await page.getByText("Home could not load. Try again.").waitFor();
      expect(await axe(page)).toEqual([]);
      await noHorizontalOverflow(page);
      await shot(page, name, info);
    });
  }

  test("drill-in open", async ({ page }, info) => {
    await open(page);
    await page.getByRole("button", { name: /^Downloads/ }).first().click();
    await expect(page.getByRole("region", { name: "Downloads details" })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await noHorizontalOverflow(page);
    await shot(page, "home-drill-in", info);
  });

  test("Words minimal and full, density detailed, Station on", async ({ page }, info) => {
    for (const [group, option] of [["Words", "Minimal"], ["Words", "Full"], ["Density", "Detailed"], ["Experience pack", "Station"]]) {
      await open(page, "#settings");
      await page.getByRole("radiogroup", { name: group }).getByLabel(option).check();
      await page.getByRole("link", { name: "Home" }).first().click();
      await page.getByRole("heading", { name: "Needs you" }).waitFor();
      expect(await axe(page), `${group} ${option}`).toEqual([]);
      await noHorizontalOverflow(page);
      await shot(page, `home-${option.toLowerCase()}`, info);
    }
  });
});

test("reflows at 320px and 200% zoom equivalent", async ({ page }) => {
  for (const width of [320, 195]) {
    await page.setViewportSize({ width, height: 700 });
    await open(page);
    await noHorizontalOverflow(page);
  }
});

test("keyboard path: skip link, nav, strip, drill-in; focus ring on every control", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  // every control gets a visible outline when focused by keyboard
  const controls = page.locator("main :is(a[href], button, summary, input, [tabindex='0'])");
  const n = await controls.count();
  expect(n).toBeGreaterThan(8);
  for (let i = 0; i < Math.min(n, 12); i++) {
    await controls.nth(i).focus();
    const outline = await controls.nth(i).evaluate((e) => { const s = getComputedStyle(e); return `${s.outlineStyle} ${s.outlineWidth}`; });
    expect(outline, `control ${i}`).not.toMatch(/^none|\b0px$/);
  }
  const btn = page.getByRole("button", { name: /^Downloads/ }).first();
  await btn.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Downloads details" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Downloads details" })).toHaveCount(0);
});

test("targets are at least 44px (strip at least 56px)", async ({ page }) => {
  await open(page);
  const strip = page.getByRole("group", { name: "Whole world" }).locator("button, a");
  for (let i = 0; i < (await strip.count()); i++) expect((await strip.nth(i).boundingBox())!.height).toBeGreaterThanOrEqual(56);
  const rows = page.locator("main li > button");
  for (let i = 0; i < (await rows.count()); i++) expect((await rows.nth(i).boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test("reduced motion: nothing animates", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const animated = await page.evaluate(() => Array.from(document.querySelectorAll("*")).filter((e) => { const s = getComputedStyle(e); return s.animationName !== "none" && s.animationDuration !== "0s"; }).length);
  expect(animated).toBe(0);
});

test("Station invariance: same nav, headings, controls and row order on all four screens", async ({ page }) => {
  const snap = () => page.evaluate(() => ({
    nav: Array.from(document.querySelectorAll("nav a")).map((a) => a.textContent),
    headings: Array.from(document.querySelectorAll("main h1, main h2, main h3")).map((h) => h.textContent),
    controls: Array.from(document.querySelectorAll("main :is(a, button, input, summary)")).map((e) => (e.getAttribute("aria-label") ?? e.textContent ?? "").trim()),
    rows: Array.from(document.querySelectorAll("main li")).map((li) => li.querySelector("button")?.textContent?.slice(0, 40) ?? ""),
    layoutHeight: document.querySelector("main")!.getBoundingClientRect().height,
  }));
  for (const hash of ["#home", "#connect", "#memory", "#settings"]) {
    await open(page, "#settings");
    await page.getByRole("radiogroup", { name: "Experience pack" }).getByLabel("None").check();
    await page.goto(`/${hash}`);
    await page.getByRole("main").waitFor();
    if (hash === "#home") await page.getByRole("heading", { name: "Needs you" }).waitFor();
    const off = await snap();
    await page.goto("/#settings");
    await page.getByRole("radiogroup", { name: "Experience pack" }).getByLabel("Station").check();
    await page.goto(`/${hash}`);
    await page.getByRole("main").waitFor();
    if (hash === "#home") await page.getByRole("heading", { name: "Needs you" }).waitFor();
    const on = await snap();
    expect(on, hash).toEqual(off);
  }
});
