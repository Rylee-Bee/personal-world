/**
 * Journal draft save-resume flow (B8; DRAFT-SYNC-SPEC-2026-09-20).
 *
 * Against the deterministic e2e mock API (scripts/e2e-api.mjs, whose
 * draft trio mirrors api.py journal_draft_* exactly — the write
 * response reports, never echoes). Serial mode: the mock holds one
 * in-memory draft, like the single per-principal slot on the server.
 */
import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function resetDraft(page: import("@playwright/test").Page) {
  await page.request.delete("http://127.0.0.1:4174/api/journal/draft");
}

async function openJournal(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Journal" }).click();
  await expect(
    page.getByRole("heading", { name: "Journal", level: 1 }),
  ).toBeVisible();
}

test("keystroke pause saves the draft to the world", async ({ page }) => {
  await resetDraft(page);
  await openJournal(page);
  const box = page.getByLabel("New entry");
  await box.click();
  await box.pressSequentially("a draft that must survive", { delay: 15 });
  // Debounce is ~1s idle; give the PUT room to land.
  await expect(async () => {
    const res = await page.request.get("http://127.0.0.1:4174/api/journal/draft");
    const body = (await res.json()) as { data?: { text?: string } };
    expect(body.data?.text).toBe("a draft that must survive");
  }).toPass({ timeout: 5_000 });
  await expect(
    page.getByText("Draft saved — safe to switch devices."),
  ).toBeVisible();
});

test("reload resumes the unsaved draft into the panel", async ({ page }) => {
  await resetDraft(page);
  await openJournal(page);
  const box = page.getByLabel("New entry");
  await box.fill("half a thought, unsaved");
  await page.request.put("http://127.0.0.1:4174/api/journal/draft", {
      data: { text: "half a thought, unsaved" },
    });
  await page.reload();
  await page.getByRole("button", { name: "Journal" }).click();
  await expect(
    page.getByRole("heading", { name: "Journal", level: 1 }),
  ).toBeVisible();
  await expect(page.getByLabel("New entry")).toHaveValue(
    "half a thought, unsaved",
  );
});

test("a newer world copy offers the chooser — never clobbers silently", async ({
  page,
}) => {
  await resetDraft(page);
  await openJournal(page);
  const box = page.getByLabel("New entry");
  // This device settles its own copy first (mirror + server agree).
  await box.fill("this device's words");
  await page.request.put("http://127.0.0.1:4174/api/journal/draft", {
      data: { text: "this device's words" },
    });
  await page.waitForTimeout(1_400); // let the debounce confirm saved_at
  // Another device saves over it while this tab idles…
  await page.request.put("http://127.0.0.1:4174/api/journal/draft", {
      data: { text: "another device wrote something newer" },
    });
  // …this panel opens fresh and must ASK, not choose for her.
  await page.reload();
  await page.getByRole("button", { name: "Journal" }).click();
  const chooser = page.getByRole("alertdialog");
  await expect(chooser).toBeVisible({ timeout: 5_000 });
  await expect(
    chooser.getByText("Two unsaved drafts are alive"),
  ).toBeVisible();
  // Keyboard-first floor: focus lands on the chooser's first option.
  await expect(page.locator("#draft-conflict-server")).toBeFocused();
  await page.getByRole("button", { name: "Keep this device's draft" }).click();
  await expect(chooser).toHaveCount(0);
  await expect(page.getByLabel("New entry")).toHaveValue(
    /this device|Keeping/,
  );
  await expect(
    page.getByText("Keeping this device's draft."),
  ).toBeVisible();
});

test("publishing clears the draft only after the confirmed write", async ({
  page,
}) => {
  await resetDraft(page);
  await openJournal(page);
  const box = page.getByLabel("New entry");
  await box.fill("ready to publish");
  await page.waitForTimeout(1_400); // one save lands first
  await page.getByRole("button", { name: "Submit journal entry" }).click();
  await expect(box).toHaveValue("");
  // The world's copy is gone too — DELETE rode the confirmed POST.
  await expect(async () => {
    const res = await page.request.get("http://127.0.0.1:4174/api/journal/draft");
    const body = (await res.json()) as { data?: { text?: string | null } };
    expect(body.data?.text).toBeNull();
  }).toPass({ timeout: 5_000 });
});
