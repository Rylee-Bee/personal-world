/**
 * Sticker moments only the screen can see, the quiet landing, the Sticker
 * Room door and Book Girl's hint. The album and the found route are stood
 * in by routes; made-up stickers only.
 */
import { test, expect } from "./test";
import type { Page } from "@playwright/test";

const AT = "2026-09-27T09:00:00Z";
const found = (id: string, name: string) => ({ id, kind: "open", shine: "paper", shape: "circle", section: "First steps", found: true, name, art: `/assets/stickers/${id}.webp`, found_at: AT });

async function withStickers(page: Page, total = 3) {
  const reported: string[] = [];
  await page.route("**/api/notifications/prefs", (route) =>
    route.fulfill({ json: { ok: true, data: { tiers: {}, sources: {}, quiet_hours: { on: false, start: "21:00", end: "08:00", tz: null } } } }),
  );
  await page.route("**/api/stickers/found", (route) => {
    reported.push(route.request().postDataJSON().sticker);
    return route.fulfill({ json: { ok: true, data: { new: true } } });
  });
  await page.route("**/api/stickers", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          pages: [
            {
              app: "worlds",
              title: "Worlds",
              look: "scifi-storybook",
              found: 2,
              shown: 3,
              secrets_remain: true,
              stickers: [
                found("sol-hi", "Sol Says Hi"),
                found("bookworm", "Bookworm"),
                { id: "pocket", kind: "riddle", shine: "paper", shape: "circle", section: "First steps", found: false, riddle: "Worlds fits in a place you carry everywhere." },
              ],
            },
          ],
          unavailable: [],
          total_found: total,
        },
      },
    }),
  );
  return reported;
}

test("seven taps on Sol: a secret, landing quietly in the corner", async ({ page }) => {
  const reported = await withStickers(page);
  await page.goto("/");
  const sol = page.getByRole("button", { name: "Worlds", exact: true });
  for (let i = 0; i < 7; i++) await sol.click();
  await expect.poll(() => reported).toContain("sol-hi");
  const peel = page.getByRole("complementary", { name: "New sticker" });
  await expect(peel).toHaveText(/New sticker: Sol Says Hi/);
  await peel.getByRole("button").click();
  await expect(page).toHaveURL(/#stickers$/);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("reading: opening a book, and the colophon at the very end of book 17", async ({ page }) => {
  const reported = await withStickers(page);
  await page.goto("/#library");
  await page.getByRole("button", { name: "Open How the interface was made" }).click();
  await expect.poll(() => reported).toContain("bookworm");
  await page.getByText("Colophon", { exact: true }).scrollIntoViewIfNeeded();
  await expect.poll(() => reported).toContain("behind-curtain");
  await expect.poll(() => reported).toContain("cover-to-cover");
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("the Sticker Room door appears after the 12th sticker, and it's a sticker too", async ({ page }) => {
  let reported = await withStickers(page, 11);
  await page.goto("/");
  await expect(page.getByRole("main")).toHaveAttribute("aria-label", "Bridge");
  await expect(page.getByRole("button", { name: "Sticker Room" })).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  reported = await withStickers(page, 12);
  await page.goto("/");
  await page.getByRole("button", { name: "Sticker Room" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sticker album" })).toBeVisible();
  expect(reported).toContain("one-more-door");
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("Book Girl's hint: once a day, only when asked", async ({ page }) => {
  await withStickers(page);
  await page.goto("/#stickers");
  const hint = page.getByRole("region", { name: "A hint from Book Girl" });
  await expect(hint.getByText("Stuck on a riddle? Book Girl can soften one a day.")).toBeVisible();
  await hint.getByRole("button", { name: "Want a hint?" }).click();
  await expect(hint.getByText(/Share button on your phone/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Book Girl gave today’s hint. There’s another tomorrow, if you want one.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Want a hint?" })).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("Rough night: finding it is a sticker, the tiny star says one kind thing, and nothing peels", async ({ page }) => {
  const reported = await withStickers(page);
  await page.goto("/#rough-night");
  await expect.poll(() => reported).toContain("soft-landing");
  await page.getByRole("button", { name: "A tiny star" }).click();
  await expect(page.getByText("I’m glad you’re here.")).toBeVisible();
  await expect.poll(() => reported).toContain("wishing-star");
  await expect(page.getByRole("complementary", { name: "New sticker" })).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
