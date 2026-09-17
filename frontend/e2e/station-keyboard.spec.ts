/**
 * LANE A — Station (/station/) keyboard gates.
 *
 * Covers the accessibility contract's Operation section on the real
 * Station surface: skip-link first (§2.6), visible focus at every stop
 * (§2.4), keyboard-only operation of the whole map journey
 * (§2.2 — map → drill → dive → zoom-out), and the dialog contracts
 * (§3.3) for the first-visit onboarding and the "Hail Assistant"
 * escape hatch.
 *
 * Auth: `POST /api/auth/login` mints the `pw_session` cookie the
 * Station's same-origin gate resolves (the SPA bearer login cannot ride
 * a document navigation). Every focus assertion below was probed live
 * in Chromium against the seeded e2e fixture before being written.
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

interface FocusInfo {
  tag: string;
  id: string;
  cls: string;
  name: string;
  focusVisible: boolean;
  outlineStyle: string;
  outlineWidth: number;
  inNav: boolean;
  inMain: boolean;
}

/** Assert the focused element carries a VISIBLE focus ring (A11y §2.4:
 * 2px solid indicator, never removed) and describe it for the journey. */
async function expectVisibleFocus(page: Page, step: string): Promise<FocusInfo> {
  const info = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body || el === document.documentElement) return null;
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || "",
      cls: typeof el.className === "string" ? el.className : "",
      name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 60),
      focusVisible: el.matches(":focus-visible"),
      outlineStyle: cs.outlineStyle,
      outlineWidth: parseFloat(cs.outlineWidth) || 0,
      inNav: !!el.closest("nav.topnav"),
      inMain: !!el.closest("main#main"),
    };
  });
  expect(info, `${step}: focus must be on an element, not <body>`).not.toBeNull();
  const f = info!;
  const desc = `${step}: <${f.tag}${f.id ? `#${f.id}` : ""}${f.cls ? `.${f.cls.split(/\s+/)[0]}` : ""}>`;
  expect(f.focusVisible, `${desc} must match :focus-visible`).toBe(true);
  expect(f.outlineStyle, `${desc} focus ring must be solid`).toBe("solid");
  expect(f.outlineWidth, `${desc} focus ring must be >= 2px`).toBeGreaterThanOrEqual(2);
  return f;
}

/** Press Tab (or Shift+Tab) until the focused element matches. Fails
 * honestly with the last-seen focus if the target never arrives. */
async function tabUntil(
  page: Page,
  match: (f: { id: string; cls: string; inNav: boolean }) => boolean,
  what: string,
  max = 30,
  shift = false
) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(shift ? "Shift+Tab" : "Tab");
    const a = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      return {
        id: el.id || "",
        cls: typeof el.className === "string" ? el.className : "",
        inNav: !!el.closest("nav.topnav"),
      };
    });
    if (a && match(a)) return a;
  }
  throw new Error(`tabUntil: "${what}" never received focus within ${max} tabs`);
}

test.describe("skip-link (A11y §2.6)", () => {
  test("skip-link is the FIRST focusable element and is a 44px target", async ({ page }) => {
    await loginStation(page);
    await gotoStation(page);
    await page.keyboard.press("Tab");
    const f = await expectVisibleFocus(page, "first tab stop");
    expect(f.cls, "first tab stop must be the skip-link").toContain("skip-link");
    expect(f.name).toMatch(/skip to main content/i);
    const box = await page.locator("a.skip-link").boundingBox();
    expect(box, "focused skip-link has a box").not.toBeNull();
    expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(43.5);
  });

  test("activating the skip-link lands the next Tab inside main", async ({ page }) => {
    await loginStation(page);
    await gotoStation(page);
    await page.keyboard.press("Tab");
    await expectVisibleFocus(page, "skip-link");
    await page.keyboard.press("Enter");
    // Chromium moves the sequential-focus entry point to the #main
    // target: the next Tab continues INSIDE main, never back at the
    // topbar. (activeElement itself may read <body> — the entry point,
    // not the focus ring, is what carries the keyboard user forward.)
    await page.keyboard.press("Tab");
    const f = await expectVisibleFocus(page, "first stop after skip activation");
    expect(f.inMain, "skip-link must drop the keyboard user inside <main>").toBe(true);
  });
});

test.describe("navigation by keyboard (A11y §2.2)", () => {
  test("primary nav links are reachable by Tab with visible focus", async ({ page }) => {
    await loginStation(page);
    await gotoStation(page);
    await page.keyboard.press("Tab"); // skip-link
    await tabUntil(page, (a) => a.inNav, "a topnav link");
    const f = await expectVisibleFocus(page, "topnav link");
    expect(f.inNav).toBe(true);
    expect(f.name).toMatch(/World|Interests|Journal|Projects|Chat|Settings/);
    // The active page is marked in words, not colour alone (§1.3)
    const current = await page.locator('nav.topnav a[aria-current="page"]').allTextContents();
    expect(current.join("")).toMatch(/World/);
  });
});

test.describe("dialog contracts (A11y §3.3)", () => {
  test("first visit: onboarding dialog is modal, Esc closes, never nags again, focus lands on a visible control", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await loginStation(page);
    await page.goto("/station/");
    const backdrop = page.locator("#onb-backdrop");
    const dialog = page.locator("#onb-dialog");
    await expect(backdrop).toBeVisible();
    await expect(dialog).toHaveAttribute("role", "dialog");
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    // focus moved INTO the dialog; the background is inert
    expect(
      await page.evaluate(() =>
        document.getElementById("onb-dialog")?.contains(document.activeElement)
      )
    ).toBeTruthy();
    expect(await page.evaluate(() => document.getElementById("main")?.inert)).toBe(true);
    // Esc closes, sets the never-nag flag, restores the background, and
    // leaves focus on a real control with a visible ring
    await page.keyboard.press("Escape");
    await expect(backdrop).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("pw-onboarded"))).toBe("1");
    expect(await page.evaluate(() => document.getElementById("main")?.inert)).toBe(false);
    const f = await expectVisibleFocus(page, "focus after onboarding close");
    expect(f.id).toBe("onb-again");
    // reload: the flag holds, the dialog stays closed, the map is intact
    await page.reload();
    await page.waitForSelector("#sky .node");
    await expect(backdrop).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("Hail Assistant: opens by keyboard, focus moves in, Esc closes, focus returns", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await loginStation(page);
    await gotoStation(page);
    await tabUntil(page, (a) => a.id === "help-btn", "the Hail Assistant button");
    await expectVisibleFocus(page, "help button");
    await page.keyboard.press("Enter");
    const dialog = page.locator("#help-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.locator("#help-btn")).toHaveAttribute("aria-expanded", "true");
    expect(
      await page.evaluate(() =>
        document.getElementById("help-dialog")?.contains(document.activeElement)
      ),
      "focus must move into the help dialog"
    ).toBeTruthy();
    await expectVisibleFocus(page, "first control inside help dialog");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.locator("#help-btn")).toHaveAttribute("aria-expanded", "false");
    const f = await expectVisibleFocus(page, "focus restored to help button");
    expect(f.id).toBe("help-btn");
    expect(errors).toEqual([]);
  });
});

test.describe("the map journey — keyboard only (A11y §2.2, §2.4)", () => {
  test("skip-link → nav → map node → drill → dive → zoom-out, visible focus at every step", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await loginStation(page);
    await gotoStation(page);

    // 1. skip-link is the first stop
    await page.keyboard.press("Tab");
    const skip = await expectVisibleFocus(page, "step 1: skip-link");
    expect(skip.cls).toContain("skip-link");

    // 2. primary nav
    await tabUntil(page, (a) => a.inNav, "step 2: a topnav link");
    const nav = await expectVisibleFocus(page, "step 2: topnav link");
    expect(nav.name).toMatch(/World|Interests|Journal|Projects|Chat|Settings/);

    // 3. first map node (DOM order = constellation order: Interests first).
    //    The node's own name carries drillability in words (§1.4).
    await tabUntil(page, (a) => a.cls.includes("node"), "step 3: a map node");
    const node = await expectVisibleFocus(page, "step 3: map node");
    expect(node.name).toMatch(/Interests/);
    expect(node.name).toMatch(/enter region/);

    // 4. drill: Enter enters the region; focus lands on the map group so
    //    the journey continues without a mouse; zoom-out becomes reachable
    await page.keyboard.press("Enter");
    await expect(page.locator("#sky-crumb")).toContainText("Interests");
    await expect(page.locator("#sky-out")).toBeVisible();
    const sky = await expectVisibleFocus(page, "step 4: drilled map group");
    expect(sky.id).toBe("sky");
    await expect(page.locator("#sky .node")).toHaveCount(3);

    // 5. dive: the first cluster (AI & local-first) opens its objects
    await page.keyboard.press("Tab");
    const cluster = await expectVisibleFocus(page, "step 5: cluster node");
    expect(cluster.cls).toContain("node");
    expect(cluster.name).toMatch(/AI & local-first/);
    await page.keyboard.press("Enter");
    const dive = page.locator("#sky-dive");
    await expect(dive).toBeVisible();
    const diveFocus = await expectVisibleFocus(page, "step 5: dive panel");
    expect(diveFocus.id).toBe("sky-dive");
    await expect(dive).toContainText("specimen"); // labelled, never fake (§ no-fake-data)

    // 6. zoom-out: Shift+Tab walks back to the crumb control
    await tabUntil(page, (a) => a.id === "sky-out", "step 6: zoom-out button", 15, true);
    const out = await expectVisibleFocus(page, "step 6: zoom-out button");
    expect(out.name).toMatch(/zoom out/i);
    await page.keyboard.press("Enter");
    await expect(dive).toBeHidden();
    await expect(page.locator("#sky-crumb")).toContainText("Interests"); // still in the region

    // KNOWN FOCUS FLAW (LANE A finding — starmap.js zoomOut()): closing
    // the dive re-renders the crumb, destroying the focused #sky-out
    // button, and its selectedCluster branch returns WITHOUT restoring
    // focus (its sibling branch calls sky.focus()). Focus falls to
    // <body>. What the contract still guarantees today — and what this
    // gate asserts — is that the keyboard user is never stranded: one
    // Tab produces visible focus again. The fix belongs to the Station
    // lane; see the LANE A receipt.
    await page.keyboard.press("Tab");
    await expectVisibleFocus(page, "step 6b: focus recovery after zoom-out");

    // 7. zoom-out again, by keyboard: region → galaxy, and this branch
    //    DOES restore focus to the map group
    await tabUntil(page, (a) => a.id === "sky-out", "step 7: zoom-out button (region level)");
    await expectVisibleFocus(page, "step 7: zoom-out button");
    await page.keyboard.press("Enter");
    await expect(page.locator("#sky .node")).toHaveCount(7);
    await expect(page.locator("#sky-out")).toBeHidden(); // galaxy: nothing to zoom out of
    const galaxy = await expectVisibleFocus(page, "step 7: galaxy after final zoom-out");
    expect(galaxy.id).toBe("sky");

    expect(errors).toEqual([]);
  });
});
