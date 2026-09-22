import { test, expect, type Page } from "@playwright/test";
import { navButtonLabels } from "./helpers";

/**
 * Landmark stability — the C3/Δ3 gate artifact.
 *
 * The council rule: the four skeleton landmarks (Overview · Memory ·
 * Chat · Settings) are non-rearrangeable and always reachable under
 * any customization, any theme, even when every section is hidden.
 * These tests drive the REAL rendered nav against deliberately
 * hostile /api/sections payloads (intercepted per-test with
 * page.route — no shared mock state, no races with other specs).
 *
 * Assertions poll for the SETTLED bar: the sections query answers
 * after first paint, so a one-shot read races the derivation.
 */

const LANDMARKS = ["Overview", "Memory", "Chat", "Settings"] as const;

function row(id: string, order: number, visible = true) {
  return {
    id,
    label: `Server ${id}`, // server labels must not override contract words
    icon: "navigation--x",
    order,
    visible,
    pinned: false,
    kind: "core",
    configured: true,
    status: null,
  };
}

async function mockSections(page: Page, sections: unknown[]) {
  await page.route("**/api/sections", (route) =>
    route.fulfill({
      json: {
        ok: true,
        status: "healthy",
        data: { schema: "sections.v1", sections },
      },
    }),
  );
}

test.describe("landmark stability (C3/Δ3)", () => {
  test("a fresh load — no stored state — shows the starfield and the four landmarks in order", async ({
    page,
  }) => {
    // A new browser context has empty localStorage by construction:
    // this is the first-run path (DEFAULT_THEME = starfield, L2).
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      "starfield",
    );
    await expect
      .poll(async () => (await navButtonLabels(page)).slice(0, 4))
      .toEqual([...LANDMARKS]);
  });

  test("a server that hides EVERYTHING still renders the four landmarks — and all four are reachable", async ({
    page,
  }) => {
    await mockSections(page, [
      row("settings", 0, false),
      row("journal", 1, false),
      row("chat", 2, false),
      row("today", 3, false),
      row("interests", 4, false),
      row("projects", 5, false),
      row("vault", 6, false),
      row("media", 7, false),
      row("lab", 8, false),
    ]);
    await page.goto("/");

    // The whole hidden layout leaves ONLY the landmarks — plus the
    // Computers placeholder, which this server (like the real one)
    // never advertises and therefore cannot hide; it tail-appends.
    // (Hiding a personal section the server DOES list is covered by
    // the unit test; server ids with no UI destination are skipped.)
    const nav = page.getByRole("navigation", { name: "World navigation" });
    await expect
      .poll(async () => navButtonLabels(page), { timeout: 10_000 })
      .toEqual(["Overview", "Memory", "Chat", "Settings", "Computers"]);

    // Reachable: every landmark still opens its screen.
    await nav.getByRole("button", { name: "Memory", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Memory", level: 1 }),
    ).toBeVisible();
    await nav.getByRole("button", { name: "Chat", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Chat", level: 1 }),
    ).toBeVisible();
    await nav.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Settings", level: 1 }),
    ).toBeVisible();
    await nav.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Operator/i, level: 1 }),
    ).toBeVisible();
  });

  test("a scrambled server order cannot reorder or rename the landmarks", async ({
    page,
  }) => {
    await mockSections(page, [
      row("settings", 0),
      row("interests", 1),
      row("chat", 2),
      row("projects", 3),
      row("memory", 4),
      row("overview", 5),
    ]);
    await page.goto("/");
    await expect
      .poll(async () => navButtonLabels(page), { timeout: 10_000 })
      .toEqual([
        // Fixed skeleton first (names AND order are the client's),
        // then the server-ordered personal sections; the server's
        // fake labels ("Server interests") never surface.
        "Overview",
        "Memory",
        "Chat",
        "Settings",
        "Interests",
        "Projects",
        "Computers",
      ]);
  });

  test("personal sections reorder while the landmarks hold their places", async ({
    page,
  }) => {
    await mockSections(page, [row("projects", 0), row("interests", 1)]);
    await page.goto("/");
    await expect
      .poll(async () => navButtonLabels(page), { timeout: 10_000 })
      .toEqual([
        "Overview",
        "Memory",
        "Chat",
        "Settings",
        "Projects",
        "Interests",
        "Computers", // never advertised by this server — tail-appended, not lost
      ]);
  });

  test("a broken sections response degrades to defaults, never an empty bar", async ({
    page,
  }) => {
    await page.route("**/api/sections", (route) =>
      route.fulfill({
        json: {
          ok: false,
          status: "unavailable",
          warnings: ["fixture: station down"],
        },
      }),
    );
    await page.goto("/");
    await expect
      .poll(async () => navButtonLabels(page), { timeout: 10_000 })
      .toEqual([
        "Overview",
        "Memory",
        "Chat",
        "Settings",
        "Interests",
        "Projects",
        "Computers",
      ]);
  });
});
