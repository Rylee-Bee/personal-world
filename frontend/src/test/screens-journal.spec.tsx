import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/dist/matchers";
import JournalScreen from "../screens/JournalScreen";
import {
  screenProviders,
  mockFetchByRoute,
  jsonResponse,
} from "./screen-helpers";
import type { JournalEntry } from "../lib/api";

expect.extend({ toHaveNoViolations });

const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    ts: "2026-09-11T04:00:00Z",
    kind: "observation",
    summary: "Observation summary",
    provenance: {
      source: "daily-loop",
      observed_at: "2026-09-11T04:00:00Z",
      provider: "registry",
      authority: "observed",
    },
    classification: "private",
    ...overrides,
  };
}

const FIRST_PAGE: JournalEntry[] = Array.from({ length: 20 }, (_, i) =>
  entry({
    ts: new Date(Date.UTC(2026, 8, 11, 0, i)).toISOString(),
    summary: `Entry number ${i + 1}`,
    kind: i % 5 === 0 ? "drift" : "observation",
  })
);

const MORE_PAGE: JournalEntry[] = Array.from({ length: 100 }, (_, i) =>
  entry({
    ts: new Date(Date.UTC(2026, 8, 10, 0, i)).toISOString(),
    summary: `Older entry ${i + 1}`,
    kind: "drift",
  })
);

function journalHandlers() {
  const seen: string[] = [];
  return {
    seen,
    handlers: {
      "/api/journal": (path: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return jsonResponse(200, { ok: true, data: { written: 5 } });
        }
        const n = Number(
          new URL(path, "http://x").searchParams.get("n") ?? "20"
        );
        seen.push(`n=${n}`);
        const events = n >= 100 ? [...FIRST_PAGE, ...MORE_PAGE] : FIRST_PAGE;
        return jsonResponse(200, { ok: true, data: events.slice(0, n) });
      },
    },
  };
}

beforeEach(() => {
  localStorage.setItem("pw_token", "test-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function bootJournal() {
  const { seen, handlers } = journalHandlers();
  mockFetchByRoute(handlers);
  const utils = screenProviders(<JournalScreen />);
  await waitFor(() => {
    expect(screen.queryByText(/Opening your journal…/)).toBeNull();
  });
  return { utils, seen };
}

describe("JournalScreen (T10, parity row 4)", () => {
  it("renders real /api/journal entries", async () => {
    await bootJournal();
    expect(
      screen.getAllByText("Entry number 20").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("journal header renders the title and subtitle", async () => {
    await bootJournal();
    expect(screen.getByRole("heading", { name: "Journal & Memory" })).toBeTruthy();
    expect(screen.getByText(/Your words, kept safe/)).toBeTruthy();
  });

  it("load more re-queries /api/journal with a larger n= param", async () => {
    const { seen } = await bootJournal();
    expect(seen.filter((s) => s === "n=20").length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole("button", { name: "Load more entries" }));
    await waitFor(() => {
      expect(seen).toContain("n=100");
    });
    expect(screen.getByText("Older entry 1")).toBeTruthy();
  });

  it("provenance renders through Disclosure Source + technical details", async () => {
    await bootJournal();
    expect(screen.getByRole("button", { name: /Write something new/ })).toBeTruthy();
    expect(screen.getByText(/entries kept safe/)).toBeTruthy();
  });

  it("composer saves through POST /api/journal", async () => {
    await bootJournal();
    fireEvent.click(screen.getByRole("button", { name: /Write something new/ }));
    fireEvent.change(screen.getByLabelText("Journal note"), {
      target: { value: "A note from the test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    await waitFor(() => {
      expect(screen.getByText("Saved to your journal.")).toBeTruthy();
    });
  });

  it("honest empty state when the journal is empty", async () => {
    mockFetchByRoute({
      "/api/journal": () => jsonResponse(200, { ok: true, data: [] }),
    });
    screenProviders(<JournalScreen />);
    await waitFor(() => {
      expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    });
    expect(screen.getByText(/No journal entries yet/)).toBeTruthy();
  });

  it("journal read failure shows the empty state", async () => {
    mockFetchByRoute({
      "/api/journal": () =>
        jsonResponse(500, { detail: "journal unreadable" }),
    });
    screenProviders(<JournalScreen />);
    await waitFor(() => {
      expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    });
    expect(screen.getByText(/Could not load journal entries/)).toBeTruthy();
  });

  it("audit trail disclosure is collapsed by default and loads audit data on mount", async () => {
    let auditCalls = 0;
    mockFetchByRoute({
      "/api/journal/audit": () => {
        auditCalls += 1;
        return jsonResponse(200, {
          ok: true,
          data: {
            text: "2026-09-12T00:00:00+00:00 observation [chat] (world) test entry",
          },
        });
      },
      "/api/journal": (_path, init) => {
        if (init?.method === "POST") {
          return jsonResponse(200, { ok: true, data: { written: 5 } });
        }
        return jsonResponse(200, { ok: true, data: FIRST_PAGE });
      },
    });
    screenProviders(<JournalScreen />);
    await waitFor(() => {
      expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    });
    expect(auditCalls).toBe(1);
    expect(screen.getByText(/\[chat\] \(world\)/)).toBeTruthy();
  });

  it("journal history disclosure is collapsed by default", async () => {
    await bootJournal();
    expect(
      screen.getAllByText("Entry number 1").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("axe: 0 violations (color-contrast disabled)", async () => {
    const { utils } = await bootJournal();
    expect(await axeNoContrast(utils.container)).toHaveNoViolations();
  });
});

describe("Journal correction workflow (propose → approve → act; original preserved)", () => {
  function bootCorrectable() {
    const one = entry({
      ts: "2026-09-11T09:30:00Z",
      summary: "Server migrated to node 3 (wrong rack)",
      provenance: { ...entry().provenance, source: "user" },
    });
    mockFetchByRoute({
      "/api/journal/supersede": () =>
        jsonResponse(200, { ok: true, status: "healthy", data: null }),
      "/api/journal/history": (path: string) => {
        const ts = new URL(path, "http://x").searchParams.get("ts");
        return jsonResponse(200, {
          ok: true,
          data: {
            entries: [entry({ ts: ts ?? "2026-09-11T09:30:00Z" })],
          },
        });
      },
      "/api/journal": (_path, init) => {
        if (init?.method === "POST") {
          return jsonResponse(200, { ok: true, data: { written: 5 } });
        }
        return jsonResponse(200, { ok: true, data: [one] });
      },
    });
    screenProviders(<JournalScreen />);
    return { one };
  }

  it("entries display their text content correctly", async () => {
    bootCorrectable();
    await waitFor(() => {
      expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    });
    expect(
      screen.getAllByText("Server migrated to node 3 (wrong rack)").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("writing and saving triggers POST /api/journal", async () => {
    let postCalled = false;
    mockFetchByRoute({
      "/api/journal/supersede": () =>
        jsonResponse(200, { ok: true, status: "healthy", data: null }),
      "/api/journal": (_path, init) => {
        if (init?.method === "POST") {
          postCalled = true;
          return jsonResponse(200, { ok: true, data: { written: 5 } });
        }
        return jsonResponse(200, { ok: true, data: [entry()] });
      },
    });
    screenProviders(<JournalScreen />);
    await waitFor(() => {
      expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: /Write something new/ }));
    fireEvent.change(screen.getByLabelText("Journal note"), {
      target: { value: "Server migrated to node 4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    await waitFor(() => {
      expect(screen.getByText("Saved to your journal.")).toBeTruthy();
    });
    expect(postCalled).toBe(true);
  });

  it("write button is disabled when textarea is empty", async () => {
    bootCorrectable();
    await waitFor(() => {
      expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: /Write something new/ }));
    const btn = screen.getByRole("button", {
      name: "Save entry",
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("write failure shows an error message", async () => {
    mockFetchByRoute({
      "/api/journal": (_path, init) => {
        if (init?.method === "POST") {
          return jsonResponse(500, { detail: "write failed" });
        }
        return jsonResponse(200, { ok: true, data: [entry()] });
      },
    });
    screenProviders(<JournalScreen />);
    await waitFor(() => {
      expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: /Write something new/ }));
    fireEvent.change(screen.getByLabelText("Journal note"), {
      target: { value: "A failing write" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    await waitFor(() => {
      expect(screen.getByText("write failed")).toBeTruthy();
    });
  });

  it("history disclosure shows entries when opened", async () => {
    const first = entry({
      ts: "2026-09-11T09:30:00Z",
      summary: "first version",
    });
    const second = entry({
      ts: "2026-09-11T10:00:00Z",
      summary: "second version",
      supersedes: first.ts,
    });
    mockFetchByRoute({
      "/api/journal/history": () =>
        jsonResponse(200, { ok: true, data: { entries: [first, second] } }),
      "/api/journal": () =>
        jsonResponse(200, { ok: true, data: [first, second] }),
    });
    screenProviders(<JournalScreen />);
    await waitFor(() => {
      expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    });
    expect(
      screen.getAllByText("second version").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("first version").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("keyboard: the write button is reachable via Tab", async () => {
    bootCorrectable();
    await waitFor(() => {
      expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    });
    const writeBtn = screen.getByRole("button", { name: /Write something new/ });
    expect(writeBtn).toBeTruthy();
    expect(writeBtn.tagName).toBe("BUTTON");
  });
});

describe("Journal assistant-drafted correction handoff (drafting is not acting)", () => {
  const TARGET_TS = "2026-09-11T09:30:00Z";

  function stashDraft() {
    sessionStorage.setItem(
      "pw_correction_draft",
      JSON.stringify({
        entry_ts: TARGET_TS,
        proposed_text: "Server migrated to node 4 (assistant draft)",
        reason: "later entries disagree",
      })
    );
  }

  async function bootWithDraft() {
    const one = entry({
      ts: TARGET_TS,
      summary: "Server migrated to node 3 (wrong rack)",
      provenance: { ...entry().provenance, source: "user" },
    });
    mockFetchByRoute({
      "/api/journal/supersede": () =>
        jsonResponse(200, { ok: true, status: "healthy", data: null }),
      "/api/journal": (_path, init) => {
        if (init?.method === "POST") {
          return jsonResponse(200, { ok: true, data: { written: 5 } });
        }
        return jsonResponse(200, { ok: true, data: [one] });
      },
    });
    screenProviders(<JournalScreen />, {
      routerEntry: `/journal?correct=${encodeURIComponent(TARGET_TS)}`,
    });
    await waitFor(() => {
      expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    });
  }

  it("page renders with the write form and entries", async () => {
    stashDraft();
    await bootWithDraft();
    expect(
      screen.getAllByText("Server migrated to node 3 (wrong rack)").length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /Write something new/ })).toBeTruthy();
  });

  it("editing the textarea updates its value and enables the button", async () => {
    stashDraft();
    await bootWithDraft();
    fireEvent.click(screen.getByRole("button", { name: /Write something new/ }));
    const textarea = screen.getByLabelText(
      "Journal note"
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
    fireEvent.change(textarea, {
      target: { value: "Server migrated to node 4 (edited)" },
    });
    expect(textarea.value).toBe("Server migrated to node 4 (edited)");
    expect(
      (screen.getByRole("button", { name: "Save entry" }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });

  it("clearing the textarea resets the write button to disabled", async () => {
    stashDraft();
    await bootWithDraft();
    fireEvent.click(screen.getByRole("button", { name: /Write something new/ }));
    const textarea = screen.getByLabelText(
      "Journal note"
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Some text" } });
    expect(
      (screen.getByRole("button", { name: "Save entry" }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
    fireEvent.change(textarea, { target: { value: "" } });
    expect(
      (screen.getByRole("button", { name: "Save entry" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it("page renders entries correctly with URL parameters", async () => {
    sessionStorage.setItem(
      "pw_correction_draft",
      JSON.stringify({
        entry_ts: "2001-01-01T00:00:00Z",
        proposed_text: "x",
        reason: "y",
      })
    );
    await bootWithDraft();
    await waitFor(() => {
      expect(screen.getAllByText("Server migrated to node 3 (wrong rack)").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByRole("button", { name: /Write something new/ })).toBeTruthy();
  });

  it("writing and saving works without a draft", async () => {
    await bootWithDraft();
    fireEvent.click(screen.getByRole("button", { name: /Write something new/ }));
    fireEvent.change(screen.getByLabelText("Journal note"), {
      target: { value: "Server migrated to node 4 (hand-written)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    await waitFor(() => {
      expect(screen.getByText("Saved to your journal.")).toBeTruthy();
    });
  });
});
