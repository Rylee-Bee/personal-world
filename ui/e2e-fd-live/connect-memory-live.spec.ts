import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Connect and Memory against the REAL dev backend (`python -m personal_world.worlds.dev`,
 * seeded reference provider, no auth), through the Vite proxy on the live port.
 *
 * The dev server registers the read API and the config CRUD, so Connect's Providers/Requests
 * lists and a write-like request can be exercised here. It does NOT register POST
 * /api/connect/try, GET /api/actions, GET /api/receipts or /api/memory/* — those tests are
 * marked fixme with the reason, and the body is kept for when the dev server serves them.
 */

/** Remove any Kept row with this title. Used from a finally so a failure never leaves a row behind. */
async function removeKeptByTitle(request: APIRequestContext, title: string) {
  const res = await request.get("/api/memory/kept");
  if (!res.ok()) return;
  const rows = (await res.json()) as { id: string; title: string }[];
  for (const row of rows.filter((r) => r.title === title)) await request.delete(`/api/memory/kept/${row.id}`);
}

test.describe("Connect against the real reference provider", () => {
  test("lists the seeded reference provider and its requests", async ({ page }) => {
    await page.goto("/#connect");
    const panel = page.getByRole("tabpanel");
    await expect(panel).toBeVisible();
    // Requests is the first tab, and the seed's saved read requests are all there.
    for (const id of ["reference.status", "reference.items", "reference.empty", "reference.down", "reference.bad", "reference-nokey.locked"]) {
      await expect(page.getByRole("button", { name: `GET ${id}` })).toBeVisible();
    }
    await page.getByRole("tab", { name: "Providers" }).click();
    await expect(page.getByRole("button", { name: "Reference", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reference (no key)" })).toBeVisible();
  });

  test("Try on a seeded read request shows a scrubbed sample and a status", async ({ page }) => {
    test.fixme(true, "dev server does not register POST /api/connect/try, so Try cannot be exercised live");
    await page.goto("/#connect");
    await page.getByRole("button", { name: "GET reference.status" }).click();
    await page.getByRole("button", { name: "Try" }).click();
    await expect(page.getByText(/Worked · status 200/)).toBeVisible();
    await expect(page.locator(".fd-try-sample")).toContainText("state");
  });

  test("a write-like request reads 'needs an approved action' and offers no Try", async ({ page, request }, info) => {
    const id = `reference.write-check-${info.project.name}`;
    const created = await request.put(`/api/config/request/${id}`, {
      headers: { "if-none-match": "*" },
      data: { schema_version: 1, id, provider: "reference", method: "POST", path: "/write", effect: "write", ttl_s: 0 },
    });
    expect(created.status()).toBe(200);
    try {
      await page.goto("/#connect");
      await expect(page.getByRole("tabpanel")).toBeVisible();
      await page.getByRole("button", { name: `POST ${id}` }).click();
      await expect(page.getByText("needs an approved action")).toBeVisible();
      await expect(page.getByRole("button", { name: "Try" })).toHaveCount(0);
    } finally {
      await request.delete(`/api/config/request/${id}`);
    }
  });
});

test.describe("Memory against the real backend", () => {
  test("add a Kept item, reload, edit it, delete it with the confirmation, reload, it is gone", async ({ page, request }, info) => {
    test.fixme(true, "dev server does not register /api/memory/*, so Memory cannot be exercised live");
    const title = `Live kept ${info.project.name}`;
    const edited = `${title} edited`;
    try {
      await page.goto("/#memory");
      await expect(page.getByRole("tabpanel")).toBeVisible();

      // add
      await page.getByRole("button", { name: "Add" }).click();
      await page.getByLabel("Title").fill(title);
      await page.getByRole("button", { name: "Add" }).click();
      await expect(page.getByText(title)).toBeVisible();

      // survives a reload
      await page.reload();
      await expect(page.getByText(title)).toBeVisible();

      // edit
      await page.locator("li.fd-memory-row", { hasText: title }).getByRole("button", { name: "Edit" }).click();
      await page.getByLabel("Title").fill(edited);
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText(edited)).toBeVisible();

      // delete through the confirmation dialog
      await page.locator("li.fd-memory-row", { hasText: edited }).getByRole("button", { name: "Delete" }).click();
      const dialog = page.getByRole("dialog", { name: `Remove ${edited}?` });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Remove" }).click();
      await expect(page.getByText(edited)).toHaveCount(0);

      // gone after a reload too
      await page.reload();
      await expect(page.getByText(edited)).toHaveCount(0);
    } finally {
      await removeKeptByTitle(request, title);
      await removeKeptByTitle(request, edited);
    }
  });

  test("Find returns the added item before deletion", async ({ page, request }, info) => {
    test.fixme(true, "dev server does not register /api/memory/*, so Memory cannot be exercised live");
    const title = `Live find ${info.project.name}`;
    try {
      await request.post("/api/memory/kept", { data: { title, body: "Findable." } });
      await page.goto("/#memory");
      await page.getByRole("tab", { name: "Find" }).click();
      await page.getByLabel("Search your Memory").fill(title);
      await expect(page.getByText(title)).toBeVisible();
    } finally {
      await removeKeptByTitle(request, title);
    }
  });

  test("History shows the events", async ({ page, request }, info) => {
    test.fixme(true, "dev server does not register /api/memory/*, so Memory cannot be exercised live");
    const title = `Live history ${info.project.name}`;
    try {
      await request.post("/api/memory/kept", { data: { title, body: "" } });
      await page.goto("/#memory");
      await page.getByRole("tab", { name: "History" }).click();
      await expect(page.getByText("created").first()).toBeVisible();
      await expect(page.getByText("kept").first()).toBeVisible();
    } finally {
      await removeKeptByTitle(request, title);
    }
  });
});
