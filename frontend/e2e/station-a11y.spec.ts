/**
 * LANE A — Station (/station/) accessibility gates: axe + 44px + console.
 *
 * The Station is the same-origin map UI served by `station_ui.py` from
 * `design/opendesign-exploration/station/`. It authenticates through the
 * canonical seam (`api.require_auth`) via the `pw_session` cookie — the
 * SPA's bearer-in-localStorage login cannot ride along on a document
 * navigation, so these specs mint a real browser session through
 * `POST /api/auth/login` (the same endpoint the OIDC/local login flow
 * uses; `tests/test_station_ui.py` covers the redirect gate itself).
 *
 * Evidence base: every assertion here was probed against the live e2e
 * fixture (seeded world, `ci-token`) in Chromium before being written.
 * Contract references are `docs/accessibility/ACCESSIBILITY_CONTRACT.md`.
 */
import { test, expect, type Page } from "playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { TOKEN, collectErrors } from "./helpers";

/** Mint the browser session the Station's same-origin gate resolves. */
async function loginStation(page: Page) {
  const res = await page.request.post("/api/auth/login", { data: { token: TOKEN } });
  expect(res.ok(), "POST /api/auth/login must mint a pw_session cookie").toBeTruthy();
}

/** Load /station/ in the steady "repeat visit" state (onboarding seen)
 * and wait until BOTH the map and the real-data panels have painted —
 * deterministic tab order and axe scans need the needs-you disclosure. */
async function gotoStation(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem("pw-onboarded", "1"); } catch { /* about:blank */ }
  });
  await page.goto("/station/");
  // Authenticated: the station gate must serve, never bounce to /login.
  await expect(page).toHaveURL(/\/station\/$/);
  await page.waitForSelector("#sky .node");
  await page.waitForSelector('[data-rd-needs-you]:not([data-rd-variant]) .rd-chip');
}

test.describe("axe gates — color-contrast ENABLED (A11y §1.1)", () => {
  // No .disableRules() anywhere: axe runs its full default rule set,
  // which includes color-contrast — same idiom as shell.spec.ts.
  const SCANS = [
    { name: "desktop galaxy", viewport: { width: 1280, height: 800 }, drill: null as string | null },
    { name: "desktop drilled", viewport: { width: 1280, height: 800 }, drill: "interests" },
    { name: "mobile-390 galaxy", viewport: { width: 390, height: 844 }, drill: null as string | null },
    { name: "mobile-390 drilled", viewport: { width: 390, height: 844 }, drill: "interests" },
    { name: "mobile-360 galaxy", viewport: { width: 360, height: 740 }, drill: null as string | null },
  ];

  for (const scan of SCANS) {
    test(`axe /station/ @${scan.name}: 0 serious/critical`, async ({ page }) => {
      await loginStation(page);
      await page.setViewportSize(scan.viewport);
      await gotoStation(page);
      if (scan.drill) {
        await page.locator(`.node[data-id="${scan.drill}"]`).click();
        await expect(page.locator("#sky-crumb")).toContainText("Interests");
      }
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.passes.some((p) => p.id === "color-contrast"),
        "color-contrast rule must have RUN (enabled, not skipped)"
      ).toBeTruthy();
      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical"
      );
      expect(
        serious.map((v) => ({ id: v.id, nodes: v.nodes.length })),
        `/station/ @${scan.name}: ${JSON.stringify(serious.map((v) => v.id))}`
      ).toEqual([]);
    });
  }

  test("axe first-visit onboarding dialog @desktop: 0 serious/critical", async ({ page }) => {
    await loginStation(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/station/");
    await expect(page.locator("#onb-dialog")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.passes.some((p) => p.id === "color-contrast"),
      "color-contrast rule must have RUN (enabled, not skipped)"
    ).toBeTruthy();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(serious.map((v) => ({ id: v.id, nodes: v.nodes.length }))).toEqual([]);
  });

  // KNOWN FINDING (LANE A, 2026-09-16) — honest red, parked as fixme:
  // At 390×844 the FIRST-VISIT onboarding dialog fails axe
  // `scrollable-region-focusable` (serious): step-1 content overflows
  // .onb-body (~621px content in a ~608px panel) and the only focusable
  // element inside is the h2[tabindex="-1"], which axe does not count as
  // keyboard-accessible scroll content. Arrow keys DO scroll while the
  // heading holds programmatic focus, but the fix (tabindex="0" on
  // .onb-body, or shorter step copy) belongs to the Station files, which
  // LANE A does not own. The map page itself is axe-clean at every width
  // probed (desktop/390/360, galaxy/drilled) — see the scans above.
  // Un-fixme to verify a Station-side fix; this test must then pass.
  test.fixme(
    "KNOWN FINDING: first-visit onboarding @390px — .onb-body scrollable-region-focusable (needs Station-side fix)",
    async ({ page }) => {
      await loginStation(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/station/");
      await expect(page.locator("#onb-dialog")).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical"
      );
      expect(serious.map((v) => ({ id: v.id, nodes: v.nodes.length }))).toEqual([]);
    }
  );
});

test.describe("44px hit-area floor (A11y §2.1)", () => {
  /**
   * Audits every interactive element a pointer can actually hit.
   * Exclusions, with reasons (WCAG 2.5.5 applies to pointer targets):
   *  - inside [aria-hidden="true"]: decorative subtree, not operable;
   *  - .sr-only: assistive-tech-only bridge control (the onboarding
   *    companion <select> persistence bridge: 1px-clipped by design,
   *    tabindex="-1", aria-hidden — never a pointer target);
   *  - [tabindex="-1"]: programmatic-focus-only;
   *  - no layout box: not rendered (closed <details>, hidden chrome).
   * Floor matches the repo idiom (helpers.assertTargets): >= 43.5px.
   */
  const AUDIT = () => {
    const sel = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll(sel))
      .filter((el) => {
        if (el.closest("[aria-hidden='true']")) return false;
        if (el.classList.contains("sr-only")) return false;
        if (el.getAttribute("tabindex") === "-1") return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          el:
            el.tagName.toLowerCase() +
            (el.id ? `#${el.id}` : "") +
            (el.className ? `.${String(el.className).trim().split(/\s+/)[0]}` : ""),
          text: (el.textContent || "").trim().slice(0, 30),
          w: Math.round(r.width * 10) / 10,
          h: Math.round(r.height * 10) / 10,
        };
      })
      .filter((x) => x.w < 43.5 || x.h < 43.5);
  };

  for (const vp of [
    { width: 1280, height: 800, name: "desktop" },
    { width: 390, height: 844, name: "mobile-390" },
    { width: 360, height: 740, name: "mobile-360" },
  ]) {
    test(`44px floor @${vp.name}: galaxy, drilled+dive, disclosures open`, async ({ page }) => {
      const errors = collectErrors(page);
      await loginStation(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoStation(page);
      expect(await page.evaluate(AUDIT), `galaxy @${vp.name}`).toEqual([]);

      // drilled region + open dive panel (crumb zoom-out, cluster nodes,
      // dive disclosure summary all become live targets)
      await page.locator('.node[data-id="interests"]').click();
      await expect(page.locator("#sky-out")).toBeVisible();
      await page.locator('.node[data-id="ai"]').click();
      await expect(page.locator("#sky-dive")).toBeVisible();
      expect(await page.evaluate(AUDIT), `drilled+dive @${vp.name}`).toEqual([]);

      // every disclosure open: technical panels + "Shape this map" editor
      await page.evaluate(() =>
        document.querySelectorAll("details").forEach((d) => { d.open = true; })
      );
      expect(await page.evaluate(AUDIT), `disclosures open @${vp.name}`).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
});

test.describe("clean-run console gate", () => {
  test("seeded load + drill + dive + zoom-out: zero console errors, zero page errors", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await loginStation(page);
    await gotoStation(page);
    await page.locator('.node[data-id="journal"]').click();
    await expect(page.locator("#sky-crumb")).toContainText("Journal");
    await page.locator("#sky .node").first().click(); // cluster → dive
    await expect(page.locator("#sky-dive")).toBeVisible();
    await page.locator("#sky-out").click(); // close dive
    await expect(page.locator("#sky-dive")).toBeHidden();
    await page.locator("#sky-out").click(); // back to galaxy
    await expect(page.locator("#sky .node")).toHaveCount(7);
    expect(errors).toEqual([]);
  });
});
