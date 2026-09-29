/**
 * Chat send — the real request/response round trip, against the
 * documented server contract (scripts/e2e-api.mjs), not a page.route
 * stub.
 *
 * Before this spec, nothing in the repo proved the live send path
 * end-to-end: ui/e2e has no chat spec, and
 * src/test/chat-draft.test.tsx (unit, mocked hooks) only covers the
 * draft-prefill behaviour, never a click through to a real POST. This
 * closes that gap by driving the unmodified UI (Chat.tsx → useSendChat
 * → sendChat → POST /api/chat) against the fixture API that speaks the
 * same envelope as src/personal_world/api.py: fill the textarea, click
 * Send, assert the POST actually fires, the reply renders once history
 * refetches (useSendChat's onSuccess invalidates chatHistory — see
 * src/data/hooks.ts), and the textarea clears. A second test proves
 * the Enter-key path (Chat.tsx's handleKeyDown) the same way.
 */
import { test, expect } from "./test";
import { gotoArea } from "./helpers";

const FIXTURE_REPLY =
  "Noted — this is a fixture reply served by the e2e mock station, not a live model.";

test("clicking Send posts to /api/chat and the reply renders", async ({ page }) => {
  await gotoArea(page, "Chat");
  const box = page.getByLabel("Message input");
  const sendButton = page.getByRole("button", { name: "Send message" });

  // Nothing typed yet: Send stays disabled — never a live-looking but
  // dead control.
  await expect(sendButton).toBeDisabled();

  const message = `e2e chat send probe ${Date.now()}`;
  await box.fill(message);
  await expect(sendButton).toBeEnabled();

  const [request] = await Promise.all([
    page.waitForRequest(
      (req) => req.url().includes("/api/chat") && req.method() === "POST",
    ),
    sendButton.click(),
  ]);
  expect(request.postDataJSON().message).toBe(message);

  // The person's own message and the fixture's reply both land in the
  // log once history refetches.
  await expect(page.getByText(message)).toBeVisible();
  await expect(page.getByText(FIXTURE_REPLY)).toBeVisible();

  // Sent: the box clears and is ready for the next message.
  await expect(box).toHaveValue("");
});

test("pressing Enter (without Shift) sends the same way", async ({ page }) => {
  await gotoArea(page, "Chat");
  const box = page.getByLabel("Message input");

  const message = `e2e chat enter-key probe ${Date.now()}`;
  await box.fill(message);

  const [request] = await Promise.all([
    page.waitForRequest(
      (req) => req.url().includes("/api/chat") && req.method() === "POST",
    ),
    box.press("Enter"),
  ]);
  expect(request.postDataJSON().message).toBe(message);

  await expect(page.getByText(message)).toBeVisible();
  await expect(box).toHaveValue("");
});

test("Shift+Enter inserts a newline instead of sending", async ({ page }) => {
  await gotoArea(page, "Chat");
  const box = page.getByLabel("Message input");

  let posted = false;
  await page.route("**/api/chat", (route) => {
    if (route.request().method() === "POST") posted = true;
    return route.fallback();
  });

  await box.fill("first line");
  await box.press("Shift+Enter");
  await box.pressSequentially("second line");
  await expect(box).toHaveValue("first line\nsecond line");
  expect(posted).toBe(false);

  await page.unrouteAll({ behavior: "ignoreErrors" });
});
