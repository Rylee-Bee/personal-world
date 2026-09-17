/**
 * LANE A — Station (/station/) motion + reflow gates.
 *
 * Contract coverage:
 *  - §6.2 OS `prefers-reduced-motion` is respected UNCONDITIONALLY — it
 *    overrides the Station's own "Gentle motion" opt-in;
 *  - motion reduced by default (ambient/looping animation is opt-in);
 *  - §6.4 layout survives 200% zoom/reflow without horizontal scroll;
 *  - small-screen (360px) reflow keeps labels legible.
 *
 * ZOOM PROXY, same discipline as shell.spec.ts: automated checks are
 * PROXIES ONLY — true 200% browser-zoom acceptance remains a HUMAN GATE.
 * Note for this page specifically: setting CSS `zoom: 2` on <html> is NOT
 * a valid proxy here. Viewport media queries do not rescale under the
 * `zoom` property, so the topbar's wrap breakpoint never fires and the
 * proxy measures a ~585px artifact overflow (measured) that real browser
 * zoom does not produce. The half-viewport geometry below (720×450 =
 * what 200% zoom yields on a 1440×900 display) is the honest reflow
 * stress, and it measures 0 overflow at every state probed.
 */
import { test, expect, type Page } from "playwright/test";
import { TOKEN, collectErrors } from "./helpers";

async function loginStation(page: Page) {
  const res = await page.request.post("/api/auth/login", { data: { token: TOKEN } });
  expect(res.ok(), "POST /api/auth/login must mint a pw_session cookie").toBeTruthy();
}

async function gotoStation(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem("pw-onboarded", "1"); } catch { /* about:blank */ }
  });
  await page.goto("/station/");
  await expect(page).toHaveURL(/\/station\/$/);
  await page.waitForSelector("#sky .node");
  await page.waitForSelector('[data-rd-needs-you]:not([data-rd-variant]) .rd-chip');
}

async function noHorizontalOverflow(page: Page, where: string) {
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(over, `no horizontal page scroll at ${where}`).toBeLessThanOrEqual(1);
}

test.describe("motion posture (A11y §6.2, motion reduced by default)", () => {
  test("default: ambient/looping motion is OFF (opt-in only), data-motion=off", async ({ page }) => {
    const errors = collectErrors(page);
    await loginStation(page);
    await gotoStation(page);
    // let one-shot entrance micro-motion finish (node-in 0.3s, sparkle 2s+1s delay)
    await page.waitForTimeout(3500);
    expect(await page.evaluate(() => document.documentElement.getAttribute("data-motion"))).toBe(
      "off"
    );
    const ambient = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === "running")
        .filter((a) => {
          const t = a.effect?.getTiming();
          return t ? t.iterations === Infinity : false;
        })
        .map((a) => String((a as unknown as { animationName?: string }).animationName ?? "transition"))
    );
    expect(ambient, "no infinite/looping animation may run by default").toEqual([]);
    expect(errors).toEqual([]);
  });

  test("OS prefers-reduced-motion wins over the app's motion=on opt-in: no ambient animation", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();
    const errors = collectErrors(page);
    // the user has OPTED IN to gentle motion; the OS setting still outranks it
    await page.addInitScript(() => {
      try {
        localStorage.setItem("pw-onboarded", "1");
        localStorage.setItem("pw-station-motion", "on");
      } catch { /* about:blank */ }
    });
    await loginStation(page);
    await page.goto("/station/");
    await page.waitForSelector("#sky .node");
    await page.waitForSelector('[data-rd-needs-you]:not([data-rd-variant]) .rd-chip');
    await page.waitForTimeout(1200); // settle any would-be entrance motion

    const state = await page.evaluate(() => ({
      osReduce: matchMedia("(prefers-reduced-motion: reduce)").matches,
      motionAttr: document.documentElement.getAttribute("data-motion"),
      running: document
        .getAnimations()
        .filter((a) => a.playState === "running")
        .map((a) => String((a as unknown as { animationName?: string }).animationName ?? "transition")),
      infinite: document
        .getAnimations()
        .filter((a) => {
          const t = a.effect?.getTiming();
          return t ? t.iterations === Infinity : false;
        })
        .map((a) => String((a as unknown as { animationName?: string }).animationName ?? "transition")),
      drift: getComputedStyle(document.querySelector(".drift")!).animationName,
      sparkle: getComputedStyle(document.querySelector(".companion-sparkle")!).animationName,
    }));
    expect(state.osReduce, "context emulates OS reduce").toBe(true);
    expect(state.motionAttr, "the app-level opt-in is applied...").toBe("on");
    expect(state.running, "...and the OS still kills every running animation").toEqual([]);
    // No ambient LOOP may exist even as a finished artifact: the global
    // reduce guard (animation-duration:0.01ms + iteration-count:1, both
    // !important) collapses every would-be infinite animation.
    // Station-side nuance (LANE A note, cosmetic): the per-layer guard
    // `.station-bg .bg-stars::before { animation: none }` LOSES CSS
    // specificity to `[data-motion="on"] .station-bg .bg-stars::before`,
    // so the computed name still reads "twinkle" under reduce — it is the
    // global !important guard, not the per-layer one, that disables it.
    // This gate therefore asserts behavior (nothing loops, nothing runs),
    // which is what the contract (§6.2) actually requires.
    expect(state.infinite, "no infinite/looping animation may exist under OS reduce").toEqual([]);
    // per-layer guards that DO win specificity are 'none' outright
    expect(state.drift).toBe("none"); // node entrance/drift loop
    expect(state.sparkle).toBe("none"); // companion sparkle pop

    // still fully operable: a drill adds no animation either
    await page.locator('.node[data-id="interests"]').click();
    await expect(page.locator("#sky-crumb")).toContainText("Interests");
    // Immediately after the drill, assert on KIND, not count: the 180ms
    // sky-zoom animation must never exist, nothing may loop, and the only
    // permissible objects are transient style transitions — which the
    // global reduce guard collapses to 0.01ms, so they are gone the
    // moment the frame turns.
    const justAfter = await page.evaluate(() =>
      document.getAnimations().map((a) => ({
        name: String((a as unknown as { animationName?: string }).animationName ?? "transition"),
        iterations: a.effect?.getTiming()?.iterations ?? null,
      }))
    );
    expect(
      justAfter.filter((a) => a.name === "sky-zoom"),
      "the drill-zoom animation must vanish under OS reduce"
    ).toEqual([]);
    expect(
      justAfter.filter((a) => a.iterations === Infinity),
      "no looping animation may be created by the drill"
    ).toEqual([]);
    await page.waitForTimeout(150);
    const settled = await page.evaluate(() =>
      document.getAnimations().filter((a) => a.playState === "running").length
    );
    expect(settled, "collapsed micro-transitions must finish immediately").toBe(0);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

test.describe("reflow (A11y §6.4)", () => {
  test("360px-wide reflow: no horizontal scroll, labels legible, chrome intact", async ({ page }) => {
    const errors = collectErrors(page);
    await loginStation(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await gotoStation(page);

    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator(".topnav")).toBeVisible();
    await expect(page.locator('[data-rd-needs-you]:not([data-rd-variant]) .rd-chip')).toBeVisible();
    await noHorizontalOverflow(page, "360px galaxy");

    // every constellation label renders and stays legible
    const labels = await page.evaluate(() => {
      const vis = Array.from(document.querySelectorAll<HTMLElement>(".node-label")).filter(
        (e) => e.getBoundingClientRect().width > 0
      );
      return {
        count: vis.length,
        minFont: Math.min(...vis.map((e) => parseFloat(getComputedStyle(e).fontSize))),
      };
    });
    expect(labels.count, "all seven world labels visible at 360px").toBe(7);
    expect(labels.minFont, "label text stays legible").toBeGreaterThanOrEqual(12);

    // drilled + dive states must not introduce overflow either
    await page.locator('.node[data-id="interests"]').click();
    await expect(page.locator("#sky-out")).toBeVisible();
    await noHorizontalOverflow(page, "360px drilled");
    await page.locator('.node[data-id="ai"]').click();
    await expect(page.locator("#sky-dive")).toBeVisible();
    await noHorizontalOverflow(page, "360px dive");
    expect(errors).toEqual([]);
  });

  // PROXY (documented above): 720×450 is the layout geometry a real 200%
  // browser zoom produces on a 1440×900 display. NOT the human gate.
  test("PROXY 200% zoom (720×450 real geometry): no horizontal scroll, content legible", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await loginStation(page);
    await page.setViewportSize({ width: 720, height: 450 });
    await gotoStation(page);
    await noHorizontalOverflow(page, "720×450 galaxy");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("#sky .node")).toHaveCount(7);
    const minFont = await page.evaluate(() => {
      const vis = Array.from(document.querySelectorAll<HTMLElement>(".node-label")).filter(
        (e) => e.getBoundingClientRect().width > 0
      );
      return Math.min(...vis.map((e) => parseFloat(getComputedStyle(e).fontSize)));
    });
    expect(minFont).toBeGreaterThanOrEqual(12);
    // drilled state at the same geometry
    await page.locator('.node[data-id="interests"]').click();
    await expect(page.locator("#sky-out")).toBeVisible();
    await noHorizontalOverflow(page, "720×450 drilled");
    expect(errors).toEqual([]);
  });
});
