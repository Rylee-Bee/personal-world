/**
 * Tests for the Interests view (C3/C4) — provenance honesty,
 * user-triggered-only discovery, and the three distinct empty states.
 *
 * Fixtures mirror providers/native_discovery.py exactly (observe() and
 * discover() shapes); a mock that taught a fiction here would train the
 * view to lie on the real station.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── Fixtures (server shapes) ────────────────────────────────────────

const ENGINE_FIND = {
  id: "pw-releases:v1.4.0",
  title: "Project Worlds v1.4.0 published",
  source: "Project Worlds releases",
  content_type: "update",
  url: "https://example.invalid/releases/pw-v1.4.0",
  description: null,
  tags: [],
  discovered_at: "2026-09-20T08:55:00+00:00",
  provenance: {
    engine: "candy-dispenser discovery (vendored)",
    source_type: "github_releases",
  },
};

function statusBody(sources: unknown[], interests: unknown[]) {
  return {
    ok: true,
    status: "healthy",
    data: {
      sources,
      interests,
      items: [],
      source_count: sources.length,
      interest_count: interests.length,
      item_count: 0,
    },
    warnings: [],
  };
}

const SOURCE_ON = {
  id: "pw-releases",
  name: "Project Worlds releases",
  source_type: "github_releases",
  config: {},
  enabled: true,
};
const SOURCE_OFF = {
  id: "lab-feed",
  name: "Lab news feed",
  source_type: "rss",
  config: { url: "https://example.invalid/feed.xml", tags: [] },
  enabled: false,
};
const INTEREST = {
  id: "self-hosting",
  name: "self-hosting",
  category: "software",
  weight: 1.0,
  created_at: "2026-09-18T12:00:00+00:00",
};

// ─── Mocked data boundary ────────────────────────────────────────────
// Everything the mock needs must live inside vi.hoisted(): vi.mock
// factories run during the import phase, before this file's body.

const { mocks, triggerDiscovery } = vi.hoisted(() => {
  const mocks = {
    statusState: {
      isPending: false,
      isError: false,
      error: null as Error | null,
      data: undefined as unknown,
    },
    discover: {
      impl: (): Promise<unknown> =>
        Promise.resolve({
          ok: true,
          status: "healthy",
          data: { items: [], count: 0, sources_queried: 1 },
          warnings: [],
        }),
    },
  };
  const triggerDiscovery = vi.fn(() => mocks.discover.impl());
  return { mocks, triggerDiscovery };
});

vi.mock("../data/hooks", () => ({
  useDiscoveryStatus: () => mocks.statusState,
}));
vi.mock("../data/api", () => ({
  triggerDiscovery,
  // describeError() imports ApiError from this module; instanceof
  // against plain Errors must stay false, which this stand-in gives.
  ApiError: class ApiError extends Error {},
}));

import { Interests } from "../screens/Interests/Interests";
import {
  captureModeNote,
  parseDiscoverRun,
  parseDiscoveryStatus,
} from "../screens/Interests/parse";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.statusState = { isPending: false, isError: false, error: null, data: undefined };
  // Default check outcome; individual tests override the mock.
  triggerDiscovery.mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: "healthy",
      data: { items: [], count: 0, sources_queried: 1 },
      warnings: [],
    }),
  );
});

afterEach(() => {
  cleanup();
});

// ─── Parsers ─────────────────────────────────────────────────────────

describe("discovery parsers", () => {
  it("reads observe() rows exactly, and counts what it must skip", () => {
    const status = parseDiscoveryStatus(
      statusBody([SOURCE_ON, SOURCE_OFF, { bogus: true }], [INTEREST]),
    );
    expect(status.sources).toHaveLength(2);
    expect(status.sources[1].enabled).toBe(false);
    expect(status.interests).toHaveLength(1);
    expect(status.skippedRows).toBe(1);
    expect(status.softFailure).toBeNull();
  });

  it("surfaces an ok:false soft failure instead of a fake success", () => {
    const status = parseDiscoveryStatus({
      ok: false,
      status: "not_configured",
      warnings: ["no discovery config"],
    });
    expect(status.softFailure).toEqual({
      status: "not_configured",
      warnings: ["no discovery config"],
    });
  });

  it("reads discover() items with provenance intact", () => {
    const run = parseDiscoverRun({
      ok: true,
      status: "healthy",
      data: { items: [ENGINE_FIND, "not-an-object"], count: 2, sources_queried: 1 },
    });
    expect(run.items).toHaveLength(1);
    expect(run.items[0].provenance.engine).toContain("candy-dispenser");
    expect(run.skippedRows).toBe(1);
    expect(run.sourcesQueried).toBe(1);
  });

  it("the capture-mode note distinguishes engine finds from source-reported ones", () => {
    expect(captureModeNote(parseDiscoverRun({
      ok: true,
      data: { items: [ENGINE_FIND], count: 1, sources_queried: 1 },
    }).items[0])).toMatch(/nothing was pushed anywhere/);
    expect(captureModeNote(parseDiscoverRun({
      ok: true,
      data: {
        items: [{ ...ENGINE_FIND, provenance: {} }],
        count: 1,
        sources_queried: 1,
      },
    }).items[0])).toMatch(/recorded no capture provenance/);
  });
});

// ─── View: no auto-polling, user-triggered finds with provenance ─────

describe("Interests view", () => {
  it("shows findings only after a user-initiated check — never on load (§8.2)", async () => {
    mocks.statusState.data = statusBody([SOURCE_ON], [INTEREST]);
    triggerDiscovery.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: "healthy",
        data: { items: [ENGINE_FIND], count: 1, sources_queried: 1 },
      }),
    );
    const user = userEvent.setup();
    render(<Interests />);

    // Opening the view touched the discovery engine zero times.
    expect(triggerDiscovery).not.toHaveBeenCalled();
    expect(
      screen.getByText(/No check run since you opened this view\./),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Check sources now" }));

    await waitFor(() => expect(triggerDiscovery).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Project Worlds v1.4.0 published")).toBeInTheDocument();

    // Provenance line: where + engine + when, and the capture note.
    const provenance = screen.getByText(/From/, { exact: false });
    expect(provenance.textContent).toContain("Project Worlds releases");
    expect(provenance.textContent).toContain("candy-dispenser discovery (vendored)");
    expect(document.querySelector("time[datetime='2026-09-20T08:55:00+00:00']")).not.toBeNull();
    expect(
      screen.getByText(/Captured by the engine into this world's own check window/),
    ).toBeInTheDocument();
  });

  it("renders the followed-interests list, read-only and honestly labelled", () => {
    mocks.statusState.data = statusBody([SOURCE_ON], [INTEREST]);
    render(<Interests />);
    expect(screen.getByText("self-hosting")).toBeInTheDocument();
    expect(
      screen.getByText(/adding an interest is a step-up write/i),
    ).toBeInTheDocument();
    // No fake "add interest" control exists on this view.
    expect(
      screen.queryByRole("button", { name: /add interest/i }),
    ).not.toBeInTheDocument();
  });

  // ── C4: the three empties are three different truths ──

  it("says 'nothing captured yet' when no sources exist", () => {
    mocks.statusState.data = statusBody([], []);
    render(<Interests />);
    expect(
      screen.getByText(/Nothing captured yet — this station has no discovery sources added\./),
    ).toBeInTheDocument();
  });

  it("says 'capture off' when sources exist but none are enabled", () => {
    mocks.statusState.data = statusBody([SOURCE_OFF], []);
    render(<Interests />);
    expect(
      screen.getByText(/Capture off — the configured sources are all switched off/),
    ).toBeInTheDocument();
  });

  it("says 'captured nothing matching' after a check with zero new finds", async () => {
    mocks.statusState.data = statusBody([SOURCE_ON], []);
    triggerDiscovery.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: "healthy",
        data: { items: [], count: 0, sources_queried: 1 },
      }),
    );
    const user = userEvent.setup();
    render(<Interests />);
    await user.click(screen.getByRole("button", { name: "Check sources now" }));
    expect(
      await screen.findByText(
        "Captured nothing matching — 1 source checked, no new finds.",
      ),
    ).toBeInTheDocument();
  });

  it("a failed check names the failure and confirms nothing was changed elsewhere", async () => {
    mocks.statusState.data = statusBody([SOURCE_ON], []);
    triggerDiscovery.mockImplementation(() => Promise.reject(new Error("station offline")));
    const user = userEvent.setup();
    render(<Interests />);
    await user.click(screen.getByRole("button", { name: "Check sources now" }));
    expect(
      await screen.findByText(/The check did not finish: station offline/),
    ).toBeInTheDocument();
  });

  it("a status read failure says what failed and what still works (§4.5)", () => {
    mocks.statusState = {
      isPending: false,
      isError: true,
      error: new Error("HTTP 503"),
      data: undefined,
    };
    render(<Interests />);
    expect(
      screen.getByText(/Couldn’t read your interests\. Nothing was changed\./),
    ).toBeInTheDocument();
    // The check button exists but cannot be pressed against a dead status.
    expect(screen.getByRole("button", { name: "Check sources now" })).toBeDisabled();
  });
});
