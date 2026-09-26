/**
 * Vault — relocated under Settings (contract: secrets are
 * infrastructure, rarely user-facing; Records ≠ Vault).
 *
 * The relocation kept the full tool: the whole e2e mock vault (the
 * real /api/vault/* contract — status, unlock, names, lock, set,
 * delete) is exercised here from Settings → Advanced, including the
 * delete-confirmation modal. Nothing outside ui/ was touched; every
 * endpoint behaves exactly as when Vault had its own nav slot.
 */
import { test, expect } from "./test";

// Serial: both tests touch the ONE mock server's vault state. Under
// the default full-parallel mode the second test's afterEach re-locks
// the shared vault while the first is mid-unlock — the save then hits
// a real 409 and the flow stalls. One file, one owner of the state.
test.describe.configure({ mode: "serial" });

test.describe("Vault under Settings", () => {
  // Leave the shared mock as found (locked, fixture name only).
  test.afterEach(async ({ request }) => {
    await request.delete("http://127.0.0.1:4174/api/vault/E2E_ADDED_TOKEN");
    await request.post("http://127.0.0.1:4174/api/vault/lock");
  });

  test("unlock → secrets list → modal delete → lock, from inside Settings", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "World navigation" })
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Settings", level: 1 }),
    ).toBeVisible();

    const vault = page.getByRole("region", { name: "Vault", exact: true });
    await expect(vault).toBeVisible();
    await expect(vault.getByText("Vault locked")).toBeVisible();

    // Unlock — the passphrase UX kept verbatim.
    await vault.getByPlaceholder("Passphrase").fill("e2e-passphrase");
    await vault.getByRole("button", { name: "Unlock" }).click();
    await expect(vault.getByText("Vault unlocked")).toBeVisible();
    await expect(vault.getByText("E2E_FIXTURE_TOKEN")).toBeVisible();

    // Add secret (POST /api/vault/set) through the form. The button's
    // accessible name is its aria-label ("Add new secret").
    await vault.getByRole("button", { name: "Add new secret" }).click();
    const form = page.getByRole("region", { name: "Add secret", exact: true });
    await form.getByLabel("Secret name").fill("E2E_ADDED_TOKEN");
    await form.getByLabel("Secret value").fill("fixture-value");
    await form.getByRole("button", { name: "Save secret" }).click();
    await expect(vault.getByText("E2E_ADDED_TOKEN")).toBeVisible();

    // Delete the added one through the native modal (§3.3): open,
    // confirm, row gone.
    await vault
      .getByRole("button", { name: "Delete secret E2E_ADDED_TOKEN" })
      .click();
    const dialog = page.getByRole("alertdialog", { name: "Delete secret" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Confirm delete secret E2E_ADDED_TOKEN" }).click();
    await expect(vault.getByText("E2E_ADDED_TOKEN")).toHaveCount(0);

    // Lock again — state honest end to end.
    await vault.getByRole("button", { name: "Lock vault" }).click();
    await expect(vault.getByText("Vault locked")).toBeVisible();
  });

  test("the Settings copy points Records at Memory, not at the Vault", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "World navigation" })
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    const vault = page.getByRole("region", { name: "Vault", exact: true });
    await expect(
      vault.getByText(/durable personal information lives in Memory under Records/i),
    ).toBeVisible();
    // And the provider grid (GET /api/status derived) is intact here.
    await expect(page.getByRole("region", { name: "Provider configuration" })).toBeVisible();
  });
});
