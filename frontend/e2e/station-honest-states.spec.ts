/**
 * LANE A — Station (/station/) honest-state gates.
 *
 * The soul rule: no fake data, ever. With nothing in the world, the
 * Needs-you panel must say "quiet AND VERIFIED" — it may only claim
 * calm after both real sources (PROP-list /api/proposals and API-067
 * /api/reminders) actually answered. When a source cannot be reached it
 * must NAME the unavailable source and refuse to claim "all quiet".
 * Illustrative map copy must stay labelled `specimen`, and attention
 * must be carried in words, never by size/colour alone (A11y §1.3/§1.4).
 *
 * The e2e fixture (e2e/server.mjs) seeds a fresh world: zero proposals,
 * zero reminders — exactly the "no data" case these gates need.
 */
import { test, expect, type Page } from "playwright/test";
import { TOKEN } from "./helpers";

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

/** Console collector that keeps each error's source URL, so a test that
 * deliberately injects a network failure can tell its own abort apart
 * from an application defect. */
function collectErrorsWithLocation(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${m.text()} @ ${m.location()?.url ?? ""}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

const VISIBLE_MOUNT = '[data-rd-needs-you]:not([data-rd-variant])';
const QUIET_MOUNT = '[data-rd-needs-you][data-rd-variant="quiet"]';

test.describe("quiet AND verified (no data ≠ unknown ≠ fake)", () => {
  test("seeded empty world: needs-you says verified-quiet, in words, with zero items", async ({
    page,
  }) => {
    await loginStation(page);
    await gotoStation(page);
    const mount = page.locator(VISIBLE_MOUNT);

    // status is carried in WORDS next to the chip colour (A11y §1.3)
    await expect(mount.locator(".rd-chip")).toHaveAttribute("data-status", "healthy");
    await expect(mount.locator(".rd-chip")).toContainText("all good");
    // quiet is claimed only AFTER both sources answered — verified, not assumed
    await expect(mount).toContainText("Nothing needs you right now");
    await expect(mount).toContainText("verified, not assumed");
    // no manufactured content: zero item rows, no demand phrasing
    await expect(mount.locator(".rd-item")).toHaveCount(0);
    await expect(mount).not.toContainText(/waiting for your decision|reminder is on/);

    // the low-demand twin mount carries the same truth (hidden at normal
    // demand — textContent, which reads rendered-or-not DOM alike)
    const quietText = (await page.locator(QUIET_MOUNT).textContent()) ?? "";
    expect(quietText).toMatch(/Nothing needs you right now/);
    expect(quietText).toMatch(/verified, not assumed/);

    // the map's illustrative copy stays labelled specimen, never posed
    // as real data; the technical disclosure names the real sources
    await expect(page.locator("#sky-info")).toContainText(/specimen/i);
    await expect(mount.locator("details.tech")).toContainText("/api/proposals");

    // no filesystem paths leak into the surface (SECURITY boundary)
    const mainText = await page.locator("main#main").innerText();
    expect(mainText).not.toMatch(/\/home\/|\/var\/|\/Users\//);
  });

  test("low-demand posture: the quiet-only view shows the same verified truth; the world stays intact", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("pw-onboarded", "1");
        localStorage.setItem("pw-station-demand", "low");
      } catch { /* about:blank */ }
    });
    await loginStation(page);
    await page.goto("/station/");
    await expect(page).toHaveURL(/\/station\/$/);
    await page.waitForSelector(`${QUIET_MOUNT} .rd-chip`);

    // the low-demand block is now the visible one, and it does not
    // downgrade the truth: same verified-quiet claim, same healthy chip
    const quiet = page.locator(QUIET_MOUNT);
    await expect(quiet).toBeVisible();
    await expect(quiet.locator(".rd-chip")).toHaveAttribute("data-status", "healthy");
    await expect(quiet).toContainText("Nothing needs you right now");
    await expect(quiet).toContainText("verified, not assumed");
    // asking less hides nothing operational: the way back is right there,
    // and the FULL needs-you section is the duplicate — hidden (UX-09)
    await expect(page.locator(".quiet-only .beam")).toBeVisible();
    await expect(page.locator("#h-needs")).toBeAttached();
    await expect(page.locator("section.needs-full")).toBeHidden();
  });
});

test.describe("unavailable sources are named, never papered over", () => {
  test("aborted /api/proposals: panel names PROP-list, refuses 'all quiet', and recovers honestly on retry", async ({
    page,
  }) => {
    const errors = collectErrorsWithLocation(page);
    await loginStation(page);
    // inject the failure BEFORE load: the shared needs-you fetch aborts
    await page.route("**/api/proposals", (route) => route.abort());
    await page.addInitScript(() => {
      try { localStorage.setItem("pw-onboarded", "1"); } catch { /* about:blank */ }
    });
    await page.goto("/station/");
    await expect(page).toHaveURL(/\/station\/$/);
    const mount = page.locator(VISIBLE_MOUNT);
    await expect(mount.locator(".rd-state")).toBeVisible();

    // status in words: unavailable, not a green wash
    await expect(mount.locator(".rd-chip")).toHaveAttribute("data-status", "unavailable");
    await expect(mount.locator(".rd-chip")).toContainText("connect right now");
    // it NAMES what could not be checked and refuses to guess calm
    await expect(mount).toContainText("Some of this could not be checked");
    await expect(mount).toContainText("PROP-list");
    await expect(mount).toContainText("would be a guess");
    await expect(mount).toContainText("It is not shown");
    await expect(mount).not.toContainText("Nothing needs you");
    // a real way forward, 44px-class button (audited in station-a11y)
    await expect(mount.locator("[data-rd-retry]")).toBeVisible();
    await expect(mount.locator("[data-rd-retry]")).toContainText("Try again");
    // the low-demand twin agrees — one shared fetch, one truth
    const quietText = (await page.locator(QUIET_MOUNT).textContent()) ?? "";
    expect(quietText).toMatch(/could not be checked/);
    expect(quietText).toMatch(/PROP-list/);

    // when the source returns, retry repaints the verified-quiet truth
    await page.unroute("**/api/proposals");
    await mount.locator("[data-rd-retry]").click();
    await expect(mount.locator(".rd-chip")).toHaveAttribute("data-status", "healthy");
    await expect(mount).toContainText("Nothing needs you right now");
    await expect(mount).toContainText("verified, not assumed");

    // the ONLY console noise allowed is the injected abort itself
    const unexpected = errors.filter(
      (e) => !/Failed to load resource.*@ .*\/api\/proposals/.test(e)
    );
    expect(unexpected, "only the injected /api/proposals abort may log an error").toEqual([]);
  });
});

test.describe("attention is carried in words (A11y §1.3, §1.4)", () => {
  test("map nodes that need you say so in their accessible name; the info strip repeats it", async ({
    page,
  }) => {
    await loginStation(page);
    await gotoStation(page);
    // every attention-marked node spells its count into its aria-label —
    // size/glow/ring only reinforce, never carry meaning alone
    const attn = page.locator("#sky .node.attn");
    const n = await attn.count();
    expect(n, "the specimen fixture marks attention on some constellations").toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const label = (await attn.nth(i).getAttribute("aria-label")) ?? "";
      expect(label, `attn node ${i} label must carry the count in words`).toMatch(
        /\d+ items? need you/
      );
    }
    // the same numbers appear in the visible info strip, named
    // (innerText reflects the CSS text-transform: the label RENDERS as
    // "NEEDS YOU HERE", so match case-insensitively)
    const info = await page.locator("#sky-info").innerText();
    expect(info).toMatch(/needs you here/i);
    expect(info).toMatch(/Projects \(1\)/);
    expect(info).toMatch(/Journal \(1\)/);
  });
});
