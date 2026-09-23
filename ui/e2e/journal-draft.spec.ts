/**
 * Journal draft save-resume flow (B8; DRAFT-SYNC-SPEC-2026-09-20) —
 * and the C3/Δ3 interruption/resumption proof.
 *
 * Against the deterministic e2e mock API (scripts/e2e-api.mjs, whose
 * draft trio mirrors api.py journal_draft_* exactly — the write
 * response reports, never echoes). Serial mode: the mock holds one
 * in-memory draft, like the single per-principal slot on the server.
 *
 * The journal now lives INSIDE the Memory landmark (the re-cut moved
 * the screen, not the behaviour). The reload tests are the contract
 * proof that an interrupted person resumes: after a reload the app
 * lands on a clearly predictable place (Overview — never a silently
 * lost state), and the unsaved draft is still there when they return
 * to Memory.
 */
import { test, expect, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

// The fixture server is shared across specs in a run, and this suite's
// publish test writes a real entry into the mock journal. Reset the
// fixture world afterwards so no later spec inherits our state (CI
// caught the leak; the reset route is test-only — see e2e-api.mjs).
test.afterAll(async ({ request }) => {
  await request.delete("http://127.0.0.1:4174/api/__test/reset");
});

async function resetDraft(page: Page) {
  await page.request.delete("http://127.0.0.1:4174/api/journal/draft");
}

/** Open Memory from wherever the app currently is (nav-scoped click —
 *  Overview's Explore tiles carry the same label, so no loose ends). */
async function openMemory(page: Page) {
  await page
    .getByRole("navigation", { name: "World navigation" })
    .getByRole("button", { name: "Memory", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Memory", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Journal", level: 2 }),
  ).toBeVisible();
}

async function gotoMemoryDraft(page: Page) {
  await page.goto("/");
  await openMemory(page);
}

test("keystroke pause saves the draft to the world", async ({ page }) => {
  await resetDraft(page);
  await gotoMemoryDraft(page);
  const box = page.getByLabel("New entry");
  await box.click();
  await box.pressSequentially("a draft that must survive", { delay: 15 });
  // Debounce is ~1s idle; give the PUT room to land (a cold CI browser
  // once flaked inside the old 5s window — same assertion, honest room).
  await expect(async () => {
    const res = await page.request.get("http://127.0.0.1:4174/api/journal/draft");
    const body = (await res.json()) as { data?: { text?: string } };
    expect(body.data?.text).toBe("a draft that must survive");
  }).toPass({ timeout: 15_000 });
  await expect(
    page.getByText("Draft saved — safe to switch devices."),
  ).toBeVisible();
});

test("interruption/resumption: reload → predictable landing → the draft is back", async ({
  page,
}) => {
  await resetDraft(page);
  await gotoMemoryDraft(page);
  const box = page.getByLabel("New entry");
  await box.fill("half a thought, unsaved");
  await page.request.put("http://127.0.0.1:4174/api/journal/draft", {
    data: { text: "half a thought, unsaved" },
  });

  // THE INTERRUPTION.
  await page.reload();

  // Δ3 floor: the reload lands somewhere CLEARLY PREDICTABLE — the
  // Overview landmark, the first thing the skeleton pins. Never a
  // silently lost or random screen.
  await expect(page.getByRole("main")).toHaveAttribute("aria-label", "Overview");
  await expect(
    page.getByRole("heading", { name: /Operator/i, level: 1 }),
  ).toBeVisible();

  // And the way back is one landmark click — after which the words
  // she was writing are WAITING, not gone.
  await openMemory(page);
  await expect(page.getByLabel("New entry")).toHaveValue(
    "half a thought, unsaved",
  );
});

test("a newer world copy offers the chooser — never clobbers silently", async ({
  page,
}) => {
  await resetDraft(page);
  await gotoMemoryDraft(page);
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
  await openMemory(page);
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
  await gotoMemoryDraft(page);
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
  }).toPass({ timeout: 15_000 });
});
