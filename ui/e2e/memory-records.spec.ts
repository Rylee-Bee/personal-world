/**
 * Memory → Records — the structured-information door (C3 re-cut,
 * Lane R-FE wiring 2026-09-21; W1-C models-off find 2026-09-22).
 *
 * Records is Memory's structured half (contract: Records ≠ Vault);
 * the Vault is not (it lives under Settings). The search block is TWO
 * deterministic doors, both models-off (TRUE-NORTH G-memory):
 *   • GET /api/records?q= — the lexical find over the world's own
 *     records (title/category/fields; locked categories fail closed).
 *   • GET /api/memory/search — the query over the station's memory
 *     index (native_memory.py shape), proven below.
 *   • /api/records* — browsable categories, per-category records,
 *     step-up-gated writes, the 409 locked-read refusal, and the
 *     ?pinned=true feed (no longer rendered on home — the Bridge shows
 *     the briefing — but still real on the station; the e2e mock
 *     (scripts/e2e-api.mjs)
 *     speaks the REAL envelopes copied from docs/RECORDS-API.md +
 *     tests/test_records.py; the locked-invitation flow additionally
 *     routes a per-test 409/step-up pair so parallel workers never
 *     race the shared mock's grant flag.
 * These tests prove: results are the world's own data, refusals and
 * empty answers render honestly per door, one door's unavailability
 * never takes the other down, and NOTHING is invented when the source
 * has nothing.
 */
import { type Page } from "@playwright/test";
import { test, expect } from "./test";

async function openRecords(page: Page) {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "World navigation" })
    .getByRole("button", { name: "Memory", exact: true })
    .click();
  const records = page.getByRole("region", { name: "Records" });
  await expect(records).toBeVisible();
  return records;
}

const recordResults = (page: Page) =>
  page.getByRole("region", { name: "Matching records" });
const indexResults = (page: Page) =>
  page.getByRole("region", { name: "Journal and memory index results" });

test.describe("Records (inside Memory)", () => {
  test("the Records-vs-Vault distinction is stated where a person reads it", async ({
    page,
  }) => {
    const records = await openRecords(page);
    await expect(
      records.getByText(/Records are not the Vault/i),
    ).toBeVisible();
  });

  test("a search returns the world's own stored lines — real endpoint, real data", async ({
    page,
  }) => {
    const records = await openRecords(page);
    // "vault" appears in a fixture journal entry ("Reviewed the vault
    // encryption approach…"); the hit must come from the API, not a
    // rendered constant.
    await page.request.delete("http://127.0.0.1:4174/api/journal/draft");
    await records.getByLabel("Search records").fill("vault encryption");
    await records.getByRole("button", { name: "Search Memory" }).click();

    const index = indexResults(page);
    await expect(
      index.getByText("Reviewed the vault encryption approach"),
    ).toBeVisible();
    // each hit carries its source kind + a machine-time timestamp
    await expect(index.locator("time[datetime]")).toHaveCount(1);
    // the records door answers too — honestly: nothing matches there
    await expect(
      recordResults(page).getByText(/No records match/),
    ).toBeVisible();
  });

  test("G-memory: pin + find a record with every model off", async ({
    page,
  }) => {
    // The mock station has no models by construction; this is the UI
    // half of the gate (the backend half: tests/test_memory_models_off.py).
    const records = await openRecords(page);

    // FIND by title — the seeded "Allergy list" is pinned.
    await records.getByLabel("Search records").fill("allergy");
    await records.getByRole("button", { name: "Search Memory" }).click();
    const found = recordResults(page);
    await expect(found.getByText("Allergy list")).toBeVisible();
    await expect(found.getByText("Pinned to Overview")).toBeVisible();

    // Deterministic: the same query again answers the same.
    await records.getByRole("button", { name: "Search Memory" }).click();
    await expect(found.getByText("Allergy list")).toBeVisible();

    // FIND by field value (lexical match over fields, not a model).
    await records.getByLabel("Search records").fill("penicillin");
    await records.getByRole("button", { name: "Search Memory" }).click();
    await expect(found.getByText("Allergy list")).toBeVisible();

    // One route to the record's actions: open its category from the
    // result — the browse view and the find view never disagree.
    await found
      .getByRole("button", {
        name: "Open category Medical for record Allergy list",
      })
      .click();
    const list = records.getByRole("region", { name: "Records in Medical" });
    await expect(list.getByText("Allergy list")).toBeVisible();
    await expect(list.getByText("Pinned to Overview")).toBeVisible();
  });

  test("a search that matches nothing says so — both doors, no padded results", async ({
    page,
  }) => {
    const records = await openRecords(page);
    await records.getByLabel("Search records").fill("zzz-not-a-real-record");
    await records.getByRole("button", { name: "Search Memory" }).click();
    // each door states its own true zero — never silence, never a pad
    await expect(records.getByText(/No records match/)).toBeVisible();
    await expect(records.getByText(/Nothing indexed matches/)).toBeVisible();
    await expect(recordResults(page).locator("li")).toHaveCount(0);
    await expect(indexResults(page).locator("li")).toHaveCount(0);
  });

  test("when one door refuses, the refusal is shown and the other door still works", async ({
    page,
  }) => {
    await page.route("**/api/memory/search**", (route) =>
      route.fulfill({
        json: {
          ok: false,
          status: "unavailable",
          warnings: ["no memory provider"],
        },
      }),
    );
    const records = await openRecords(page);
    await records.getByLabel("Search records").fill("allergy");
    await records.getByRole("button", { name: "Search Memory" }).click();
    // the index door shows the server's own word, unsoftened…
    await expect(records.getByText("no memory provider")).toBeVisible();
    await expect(indexResults(page).locator("li")).toHaveCount(0);
    // …and the records find — which never depended on the index or any
    // model — still answers.
    await expect(recordResults(page).getByText("Allergy list")).toBeVisible();
  });
});

// ─── The wired Records API (Lane R-FE) ───────────────────────────────

const pathIs = (url: string, pathname: string): boolean =>
  new URL(url).pathname === pathname;

test.describe("Records browsing (categories → records)", () => {
  test("categories list names, counts, and the locked badge", async ({
    page,
  }) => {
    const records = await openRecords(page);
    const categories = records.getByRole("region", { name: "Record categories" });
    await expect(
      categories.getByRole("button", { name: "Category Medical" }),
    ).toBeVisible();
    // count is text, not decoration
    await expect(categories.getByText("2 records")).toBeVisible();
    // the locked category is LISTED (name + count + locked) — the
    // contract keeps its existence visible without elevation.
    const identity = categories.getByRole("button", {
      name: "Category Identity documents",
    });
    await expect(identity).toBeVisible();
    await expect(categories.getByText("Locked").first()).toBeVisible();
  });

  test("selecting a category lists its records", async ({ page }) => {
    const records = await openRecords(page);
    await records
      .getByRole("button", { name: "Category Medical" })
      .click();
    const list = records.getByRole("region", { name: "Records in Medical" });
    await expect(list).toBeVisible();
    await expect(list.getByText("Allergy list")).toBeVisible();
    await expect(list.getByText("Clinic address")).toBeVisible();
    // a seeded pinned record says where it surfaces
    await expect(list.getByText("Pinned to Overview")).toBeVisible();
  });

  test("an empty category is a true zero, not a mask", async ({ page }) => {
    // No records match this category — the server answers ok:true +
    // empty list; the panel must say so plainly.
    await page.route(
      (url) => pathIs(url.toString(), "/api/records"),
      (route) =>
        route.fulfill({
          json: {
            ok: true,
            status: "healthy",
            data: { category: "medical", locked: false, records: [] },
          },
        }),
    );
    const records = await openRecords(page);
    await records.getByRole("button", { name: "Category Medical" }).click();
    await expect(
      records.getByText(/true zero, not a missing source/),
    ).toBeVisible();
  });
});

test.describe("Locked category → calm step-up invitation", () => {
  test("the 409 locked envelope invites elevation; step-up unlocks the view", async ({
    page,
  }) => {
    // Per-test step-up state so the shared mock's global grant is
    // never raced by parallel workers. Envelope shapes are verbatim
    // from RECORDS-API.md / test_records.py.
    let granted = false;
    await page.route(
      (url) => pathIs(url.toString(), "/api/records"),
      (route) => {
        const u = new URL(route.request().url());
        if (u.searchParams.get("category") === "identity-documents" && !granted) {
          return route.fulfill({
            status: 409,
            json: {
              ok: false,
              status: "locked",
              category: "identity-documents",
              warnings: [
                "category 'identity-documents' is locked: step-up required to read",
              ],
            },
          });
        }
        return route.fulfill({
          json: {
            ok: true,
            status: "healthy",
            data: {
              category: "identity-documents",
              locked: true,
              records: [
                {
                  id: "passport-number-d7e8f9",
                  category: "identity-documents",
                  category_name: "Identity documents",
                  title: "Passport number",
                  fields: { number: "Z999-FIXTURE" },
                  pinned: false,
                  created: "2026-09-17T12:00:00+00:00",
                  updated: "2026-09-17T12:00:00+00:00",
                },
              ],
            },
          },
        });
      },
    );
    await page.route(
      (url) => pathIs(url.toString(), "/api/auth/step-up"),
      (route) => {
        granted = true;
        return route.fulfill({
          json: {
            ok: true,
            data: {
              has_step_up: true,
              expires_in: 300,
              principal_id: "person:operator",
            },
          },
        });
      },
    );

    const records = await openRecords(page);
    await records
      .getByRole("button", { name: "Category Identity documents" })
      .click();

    // The invitation: the server's own words, role=note, no error-red
    // dead end, and a working door.
    const invite = records.getByRole("region", { name: "Step up to continue" });
    await expect(invite.getByText("step-up required to read")).toBeVisible();
    await expect(
      invite.getByRole("note"),
    ).toBeVisible();

    // Step up → contents appear.
    await invite.getByLabel("Re-present your credential").fill("fixture-credential");
    await invite.getByRole("button", { name: "Step up" }).click();
    const list = records.getByRole("region", { name: "Records in Identity documents" });
    await expect(list.getByText("Passport number")).toBeVisible();
    await expect(list.getByText("Z999-FIXTURE")).toBeVisible();
  });
});

test.describe("Records writes (step-up-gated)", () => {
  test("create → pin → appears pinned → delete", async ({
    page,
  }) => {
    const records = await openRecords(page);
    await records.getByRole("button", { name: "Add record" }).click();

    const form = page.getByRole("form", { name: "New record" });
    await expect(form).toBeVisible();
    await form.getByLabel("Title", { exact: true }).fill("E2E insurance card");
    await form.getByLabel("Category", { exact: true }).fill("E2E notes");
    await form.getByLabel("Field 1 name").fill("policy");
    await form.getByLabel("Field 1 value").fill("PPO-42");
    await form.getByRole("button", { name: "Create record" }).click();

    // Saved: honest status line, and the new category is selected.
    await expect(
      records.getByText(/Record “E2E insurance card” saved in e2e-notes/),
    ).toBeVisible();
    const list = records.getByRole("region", { name: "Records in E2E notes" });
    await expect(list.getByText("E2E insurance card")).toBeVisible();
    await expect(list.getByText("PPO-42")).toBeVisible();

    // Pin it → the pinned feed (GET /api/records?pinned=true) carries it.
    // Home is the Bridge now and the Bridge renders no pinned feed, so
    // the feed's own truth is asserted through the station API.
    await list.getByRole("button", { name: "Pin record E2E insurance card" }).click();
    await expect(list.getByText("Pinned to Overview")).toBeVisible();
    const pinnedFeed = await (
      await page.request.get("http://127.0.0.1:4174/api/records?pinned=true")
    ).json();
    expect(
      pinnedFeed.data.records.map((r: { title: string }) => r.title),
    ).toContain("E2E insurance card");

    // G-memory find: the freshly pinned record is discoverable by a
    // plain lexical query — no model anywhere, no index to rebuild.
    await records.getByLabel("Search records").fill("insurance");
    await records.getByRole("button", { name: "Search Memory" }).click();
    const found = recordResults(page);
    await expect(found.getByText("E2E insurance card")).toBeVisible();
    await expect(found.getByText("Pinned to Overview")).toBeVisible();

    // Leave Memory and come back — the screen remounts with a clean
    // search box (the round trip the old Overview hop also provided).
    await page
      .getByRole("navigation", { name: "World navigation" })
      .getByRole("button", { name: "Bridge", exact: true })
      .click();
    await expect(page.getByRole("region", { name: "Star map" })).toBeVisible();
    await page
      .getByRole("navigation", { name: "World navigation" })
      .getByRole("button", { name: "Memory", exact: true })
      .click();
    const records2 = page.getByRole("region", { name: "Records" });
    await records2.getByRole("button", { name: "Category E2E notes" }).click();
    const list2 = records2.getByRole("region", { name: "Records in E2E notes" });
    await expect(list2.getByText("E2E insurance card")).toBeVisible();
    await list2.getByRole("button", { name: "Delete record E2E insurance card" }).click();

    const dialog = page.getByRole("alertdialog", { name: "Delete record" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("This cannot be undone."),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel delete" }).click();
    await expect(dialog).toBeHidden();
    // Cancel kept it — then confirm for real.
    await expect(list2.getByText("E2E insurance card")).toBeVisible();
    await list2.getByRole("button", { name: "Delete record E2E insurance card" }).click();
    await page.getByRole("button", { name: "Confirm delete record E2E insurance card" }).click();

    await expect(
      records2.getByText(/Record “E2E insurance card” deleted/),
    ).toBeVisible();
    await expect(
      records2.getByText(/true zero, not a missing source/),
    ).toBeVisible();

    // And the pinned feed no longer carries it.
    const pinnedAfter = await (
      await page.request.get("http://127.0.0.1:4174/api/records?pinned=true")
    ).json();
    const pinnedTitles = pinnedAfter.data.records.map(
      (r: { title: string }) => r.title,
    );
    expect(pinnedTitles).not.toContain("E2E insurance card");
    expect(pinnedTitles).toContain("Allergy list");
  });

  test("a 403 from the step-up gate surfaces the elevate-first door, not silence", async ({
    page,
  }) => {
    // Refuse every record write exactly like require_step_up does
    // off-loopback without a grant.
    await page.route(
      (url) => pathIs(url.toString(), "/api/records"),
      (route) => {
        if (route.request().method() === "POST") {
          return route.fulfill({
            status: 403,
            json: { detail: "write requires step-up auth" },
          });
        }
        return route.fallback();
      },
    );
    const records = await openRecords(page);
    const form = page.getByRole("form", { name: "New record" });
    await records.getByRole("button", { name: "Add record" }).click();
    await form.getByLabel("Title", { exact: true }).fill("Never saved");
    await form.getByLabel("Category", { exact: true }).fill("E2E gate");
    await form.getByRole("button", { name: "Create record" }).click();

    await expect(
      records.getByText("This save needs step-up first — the write was not made."),
    ).toBeVisible();
    // …and the invitation, not a dead end:
    await expect(
      records.getByRole("button", { name: "Step up" }),
    ).toBeVisible();
    // Nothing was written: the form stays open, and the category
    // never lands in the list.
    await expect(form).toBeVisible();
    await expect(
      records.getByRole("button", { name: "Category E2E gate" }),
    ).toHaveCount(0);
  });
});

test.describe("Degraded: no memory provider", () => {
  test("Records states the capability truth; the Bridge renders no Pinned section", async ({
    page,
  }) => {
    const unavailable = {
      ok: false,
      status: "unavailable",
      warnings: ["no memory provider"],
    };
    await page.route(
      (url) =>
        pathIs(url.toString(), "/api/records") ||
        pathIs(url.toString(), "/api/records/categories"),
      (route) => route.fulfill({ json: unavailable }),
    );

    const records = await openRecords(page);
    // The server's own warning word, plainly — no fake-empty list.
    await expect(records.getByText("no memory provider")).toBeVisible();
    await expect(records.getByText(/No source yet for records/)).toBeVisible();
    await expect(
      records.getByRole("button", { name: "Category Medical" }),
    ).toHaveCount(0);

    // The Bridge (home) carries its own briefing, not a records feed:
    // the degraded memory provider leaves no error card on the star map
    // and no Pinned section anywhere on it.
    await page
      .getByRole("navigation", { name: "World navigation" })
      .getByRole("button", { name: "Bridge", exact: true })
      .click();
    await expect(page.getByRole("region", { name: "Star map" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Pinned" })).toHaveCount(0);
    await expect(page.getByText("no memory provider")).toHaveCount(0);
  });

  test("the pinned feed is real on a healthy station (through the station API)", async ({
    page,
  }) => {
    await page.goto("/");
    const pinned = await (
      await page.request.get("http://127.0.0.1:4174/api/records?pinned=true")
    ).json();
    const titles = pinned.data.records.map((r: { title: string }) => r.title);
    expect(titles).toContain("Allergy list");
    // Home is the Bridge: it shows the briefing, not the pinned feed.
    await expect(
      page.getByRole("region", { name: "Star map" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Pinned" })).toHaveCount(0);
  });
});
