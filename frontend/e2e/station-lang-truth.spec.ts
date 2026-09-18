/**
 * LANG-021/025–028/060 — journal + settings language truth gates.
 *
 * Journal page: the specimen "journal view" is gone from the normal
 * route; the real server journal (API-005) carries the honest states;
 * the browser-local tabs say "Notes (this device only)", never "Vault".
 *
 * Settings page: destructive controls name the exact browser-local
 * object and scope; confirmation names what is deleted, what is NOT
 * changed, and cannot be undone; `Cancel` has initial focus; success
 * names what changed and what did not; storage failure never claims
 * success (LANG-060).
 */
import { test, expect, type Page } from "playwright/test";
import { TOKEN, collectErrors } from "./helpers";

test.use({ reducedMotion: "reduce" });

async function login(page: Page) {
  const res = await page.request.post("/api/auth/login", { data: { token: TOKEN } });
  expect(res.ok(), "POST /api/auth/login must mint a session").toBeTruthy();
}

async function gotoStation(page: Page, path: string) {
  await page.addInitScript(() => {
    try { localStorage.setItem("pw-onboarded", "1"); } catch { /* about:blank */ }
  });
  await page.goto(`/station/${path}`);
  await page.waitForSelector("main", { state: "attached" });
}

test.describe("Journal page truthfulness", () => {
  test("no specimen panel on the normal route; real server journal renders", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page);
    await gotoStation(page, "journal.html");
    await page.waitForSelector("[data-rd-journal] .rd-chip", { timeout: 10_000 });
    const body = await page.locator("main").textContent();
    const text = body || "";
    // the specimen *journal view* is gone from the normal route (map
    // region copy legitimately keeps its labelled specimen notes)
    expect(await page.locator("#journal-view").count()).toBe(0);
    expect(await page.locator(".cv-view").count()).toBe(0);
    expect(text).not.toContain("No journal is connected yet");
    expect(text).not.toContain("specimen · sample entry");
    expect(text).not.toContain("Preview state");
    expect(text).not.toContain("no journal is connected yet");
    // the real journal header is present and answered
    await expect(page.locator("[data-rd-journal]")).toBeVisible();
    await expect(page.locator("[data-rd-journal] .rd-chip")).toBeVisible();
    expect(text).toMatch(/Your journal/);
    expect(errors).toEqual([]);
  });

  test("browser notes are labelled 'Notes (this device only)', never 'Vault'", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page);
    await gotoStation(page, "journal.html");
    const text = await page.locator("main").textContent();
    const body = text || "";
    expect(body).not.toMatch(/vault/i);
    expect(body).toContain("Notes (this device only)");
    // save checkbox states the real boundary
    expect(body).toContain("Saved on this device only — not sent to your world yet.");
    expect(body).not.toMatch(/Seed 100000%|never encrypted|stays private/i);
    // hidden-from-map honesty: notes panel is clear about the storage boundary
    await page.locator('[data-tab="vault"]').click();
    const panel = await page.locator("#panel-vault").textContent();
    expect(panel).toMatch(/on this device only|not sent to your world/i);
    expect(errors).toEqual([]);
  });

  test("saving a note works and reports where it was saved (LANG-060 success path)", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page);
    await gotoStation(page, "journal.html");
    await page.locator('[data-tab="write"]').click();
    await page.fill("#entry-body-input", "A truthful note for the language gate");
    await page.click("#entry-save-btn");
    await expect(page.locator("#save-status")).toContainText("Saved in this browser");
    const stored = await page.evaluate(() => localStorage.getItem("pw-journal-entries"));
    expect(stored).toContain("A truthful note for the language gate");
    expect(errors).toEqual([]);
  });

  test("a blocked storage write never claims success (LANG-060)", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page);
    await gotoStation(page, "journal.html");
    // break persistence for this page's key before page scripts run
    await page.addInitScript(() => {
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === "pw-journal-entries") {
          throw new Error("QuotaExceededError");
        }
        return real.call(this, key, value);
      };
    });
    await page.goto("/station/journal.html");
    await page.waitForSelector("main", { state: "attached" });
    await page.locator('[data-tab="write"]').click();
    await page.fill("#entry-body-input", "This must not be reported as saved");
    await page.click("#entry-save-btn");
    await expect(page.locator("#save-status")).toContainText(
      "Couldn’t save this in your browser. Nothing was saved."
    );
    await expect(page.locator("#save-status")).toContainText("Check browser storage settings");
    // the form still holds the unsaved note — no false success, no data loss
    expect(await page.inputValue("#entry-body-input")).toBe(
      "This must not be reported as saved"
    );
    expect(await page.evaluate(() => localStorage.getItem("pw-journal-entries"))).toBeNull();
    expect(errors).toEqual([]);
  });
});

test.describe("Settings destructive controls truthfulness", () => {
  test("labels name the browser-local object and scope", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page);
    await gotoStation(page, "settings.html");
    const body = (await page.locator("#h-data").locator("xpath=..").textContent()) || "";
    expect(body).toContain("Delete browser notes");
    expect(body).toContain("Delete browser interests");
    expect(body).toContain("Delete local chat history");
    expect(body).toContain("Reset saved map positions");
    expect(body).toContain("Delete everything saved in this browser");
    expect(body).not.toMatch(/Clear everything|Clear journal|Clear chat log/);
    expect(errors).toEqual([]);
  });

  test("confirmation is scoped, Cancel-focused, and Cancel deletes nothing", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page);
    await gotoStation(page, "settings.html");
    await page.evaluate(() => {
      localStorage.setItem("pw-journal-entries", "[]");
    });
    await page.click('[data-clear="journal"]');
    const dialog = page.locator("#delete-dialog");
    await expect(dialog).toBeVisible();
    const scope = await page.locator("#delete-dialog").textContent();
    expect(scope).toContain("Delete browser notes?");
    expect(scope).toContain("It does not change the journal kept on the server");
    expect(scope).toContain("This cannot be undone");
    // initial focus is the safe action (A11y destructive contract)
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("delete-cancel");
    // Cancel leaves the data untouched
    await page.click("#delete-cancel");
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("pw-journal-entries"))).toBe("[]");
    expect(errors).toEqual([]);
  });

  test("confirming a scoped delete reports what changed and what did not", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page);
    await gotoStation(page, "settings.html");
    await page.evaluate(() => {
      localStorage.setItem("pw-journal-entries", "[]");
      localStorage.setItem("pw-chat-log", "[]");
    });
    await page.click('[data-clear="journal"]');
    await page.locator("#delete-dialog").getByRole("button", { name: "Delete browser notes" }).click();
    const status = await page.locator("#data-status").textContent();
    expect(status).toContain("Browser notes were deleted from this browser");
    expect(status).toContain("was not changed");
    expect(await page.evaluate(() => localStorage.getItem("pw-journal-entries"))).toBeNull();
    // the chat log is NOT part of this object's scope
    expect(await page.evaluate(() => localStorage.getItem("pw-chat-log"))).toBe("[]");
    expect(errors).toEqual([]);
  });

  test("‘Delete everything saved in this browser’ names every affected object and clears only pw- keys", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await login(page);
    await gotoStation(page, "settings.html");
    await page.evaluate(() => {
      localStorage.setItem("pw-chat-log", "[]");
      localStorage.setItem("pw-interests", "{}");
      localStorage.setItem("foreign-note-keep", "keep me");
    });
    await page.click('[data-clear="all"]');
    const scope = await page.locator("#delete-dialog-desc").textContent();
    for (const object of ["browser notes", "browser interests", "local chat history", "map positions", "Station preferences"]) {
      expect(scope).toContain(object);
    }
    expect(scope).toContain("does not change anything on the server");
    await page.locator("#delete-dialog").getByRole("button", { name: "Delete everything in this browser" }).click();
    const status = await page.locator("#data-status").textContent();
    expect(status).toContain("Everything saved in this browser was deleted");
    expect(status).toMatch(/Server data|connected services/);
    await expect.poll(() =>
      page.evaluate(() => localStorage.getItem("pw-chat-log"))
    ).toBeNull();
    // foreign (non pw-) keys are untouched — the scope is exact
    expect(await page.evaluate(() => localStorage.getItem("foreign-note-keep"))).toBe("keep me");
    expect(errors).toEqual([]);
  });

  test("dialog supports keyboard with a visible focus ring and Esc closes", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page);
    await gotoStation(page, "settings.html");
    await page.click('[data-clear="journal"]');
    await expect(page.locator("#delete-dialog")).toBeVisible();
    // initial focus is the safe action
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("delete-cancel");
    // keyboard movement carries a visible ring inside the dialog
    await page.keyboard.press("Tab");
    const cs = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el
        ? { id: el.id, matches: el.matches(":focus-visible"), width: parseFloat(getComputedStyle(el).outlineWidth) || 0 }
        : null;
    });
    expect(cs?.id).toBe("delete-confirm");
    expect(cs?.matches).toBe(true);
    expect(cs?.width).toBeGreaterThanOrEqual(2);
    await page.keyboard.press("Escape");
    await expect(page.locator("#delete-dialog")).toBeHidden();
    expect(errors).toEqual([]);
  });
});
