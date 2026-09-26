/**
 * Tests for the Settings Room (C1/C2) — schema-driven renderer,
 * undo-visible writes, read-only honesty.
 *
 * Pattern: the data layer is mocked at the hooks boundary (same
 * philosophy as src/test/hooks.test.tsx, which mocks the API layer):
 * the component's job is to render the server vocabulary honestly, so
 * the fixtures ARE the vocabulary from prefs.py, and the assertions
 * are the a11y floor + the C2 no-auto-persist contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── Fixture: GET /api/prefs/schema exactly as prefs.py describes it ──

const SCHEMA_BODY = {
  motion: {
    type: "enum", default: "reduced", floor: "off",
    allowed: ["off", "reduced", "subtle"],
  },
  contrast: {
    type: "enum", default: "comfortable", floor: "comfortable",
    allowed: ["comfortable", "high"],
  },
  text_scale: {
    type: "number", default: 1.0, floor: 1.0,
    allowed: [1.0, 1.25, 1.5], integer: false, unit: "",
  },
  density: {
    type: "enum", default: "comfortable", floor: "compact",
    allowed: ["comfortable", "compact"],
  },
  target_size: {
    type: "number", default: 44, floor: 44,
    allowed: [44, 56], integer: true, unit: "px",
  },
  companion: {
    type: "enum", default: "personal-world", floor: "personal-world",
    allowed: [
      "personal-world", "mermaid", "robot",
      "world-tree-squirrel", "taco-news-truck",
    ],
  },
  accent: {
    type: "enum", default: "world-keeper", floor: "world-keeper",
    allowed: ["world-keeper", "rylee"],
  },
};

const PREFS_BODY = {
  motion: "reduced",
  contrast: "comfortable",
  text_scale: 1,
  density: "comfortable",
  target_size: 44,
  companion: "mermaid",
  accent: "world-keeper",
};

// ─── Mocked hooks boundary ───────────────────────────────────────────

const { mutate, mocks } = vi.hoisted(() => {
  const mutate = vi.fn(
    (
      body: Record<string, string | number>,
      options?: {
        onSuccess?: (res: unknown) => void;
        onError?: (e: Error) => void;
      },
    ) => {
      // Same response shape as api.py prefs_put: the FULL effective
      // table after the write (this is what the room applies to the
      // document — C12).
      options?.onSuccess?.({
        ok: true,
        status: "healthy",
        data: { ...PREFS_BODY, ...body },
      });
    },
  );
  const mocks = {
    prefsState: {
      isPending: false,
      isError: false,
      error: null as Error | null,
      data: { ok: true, data: {} as Record<string, unknown> },
    },
    schemaState: {
      isPending: false,
      isError: false,
      error: null as Error | null,
      data: undefined as unknown,
    },
    sessionState: {
      isPending: false,
      isError: false,
      error: null as Error | null,
      data: undefined as unknown,
    },
    crewState: {
      isPending: false,
      isError: false,
      data: undefined as { ok: boolean; data: unknown[] } | undefined,
    },
  };
  return { mutate, mocks };
});

vi.mock("../data/hooks", () => ({
  usePrefs: () => mocks.prefsState,
  usePrefsSchema: () => mocks.schemaState,
  useSession: () => mocks.sessionState,
  usePutPrefs: () => ({ isPending: false, mutate }),
  useCrew: () => mocks.crewState,
}));

import { SettingsRoom } from "../screens/Settings/SettingsRoom";
import {
  diffPrefs,
  parsePrefsSchema,
  prefKeyLabel,
  prefValueLabel,
  readPrefsValues,
} from "../screens/Settings/parse";

// The unit project runs without vitest globals, so RTL's automatic
// cleanup does not register — unmount explicitly between tests.
afterEach(() => {
  cleanup();
  // C12: applies mutate <html> (prefs.py vocabulary). Reset it so no
  // DOM truth leaks between tests.
  const root = document.documentElement;
  for (const attr of [
    "data-pw-motion",
    "data-pw-contrast",
    "data-pw-text-scale",
    "data-pw-density",
    "data-pw-target-size",
    "data-pw-companion",
    "data-pw-accent",
    "data-theme",
  ]) {
    root.removeAttribute(attr);
  }
  for (const name of [
    "--pw-motion",
    "--pw-contrast",
    "--pw-text-scale",
    "--pw-density",
    "--pw-target-size",
    "--pw-companion",
    "--pw-accent",
    "--pw-motion-duration",
    "--pw-motion-ambient",
  ]) {
    root.style.removeProperty(name);
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prefsState = {
    isPending: false,
    isError: false,
    error: null,
    data: { ok: true, data: { ...PREFS_BODY } },
  };
  mocks.schemaState = {
    isPending: false,
    isError: false,
    error: null,
    data: { ok: true, data: SCHEMA_BODY },
  };
  mocks.sessionState = {
    isPending: false,
    isError: false,
    error: null,
    data: {
      ok: true,
      data: {
        principal_id: "person:operator",
        auth_method: "instance-token",
        has_step_up: true,
      },
    },
  };
});

// ─── Pure parser tests ───────────────────────────────────────────────

describe("parsePrefsSchema", () => {
  it("renders every prefs.py key as a typed entry, sorted", () => {
    const parsed = parsePrefsSchema({ ok: true, data: SCHEMA_BODY });
    expect(parsed.rejectedKeys).toEqual([]);
    expect(parsed.entries.map((e) => e.key)).toEqual([
      "accent", "companion", "contrast", "density", "motion",
      "target_size", "text_scale",
    ]);
    const motion = parsed.entries.find((e) => e.key === "motion")!;
    expect(motion.type).toBe("enum");
    expect(motion.allowed).toEqual(["off", "reduced", "subtle"]);
    const target = parsed.entries.find((e) => e.key === "target_size")!;
    expect(target.integer).toBe(true);
    expect(target.unit).toBe("px");
  });

  it("rejects entries it cannot describe faithfully, by key name", () => {
    const parsed = parsePrefsSchema({
      ok: true,
      data: {
        ...SCHEMA_BODY,
        mystery: { type: "vibes", default: "x" },
        empty_enum: { type: "enum", default: "a", floor: "a", allowed: [] },
      },
    });
    expect(parsed.rejectedKeys.sort()).toEqual(["empty_enum", "mystery"]);
    expect(parsed.entries).toHaveLength(7);
  });

  it("degrades an unparseable body to zero entries, never a guess", () => {
    const parsed = parsePrefsSchema({ ok: true, data: "not-a-record" });
    expect(parsed.entries).toEqual([]);
    expect(parsed.rejectedKeys).toEqual(["(unparseable body)"]);
  });
});

describe("readPrefsValues / diffPrefs", () => {
  const entries = parsePrefsSchema({ ok: true, data: SCHEMA_BODY }).entries;

  it("falls back to the entry default when the server omitted a key", () => {
    const values = readPrefsValues({ ok: true, data: { motion: "off" } }, entries);
    expect(values.motion).toBe("off");
    expect(values.target_size).toBe(44);
  });

  it("diffs only changed keys (C2 patch body)", () => {
    const server = readPrefsValues({ ok: true, data: PREFS_BODY }, entries);
    const draft = { ...server, density: "compact" };
    expect(diffPrefs(server, draft)).toEqual([
      { key: "density", from: "comfortable", to: "compact" },
    ]);
  });
});

describe("labels", () => {
  it("carries meaning in words, not values (§1.3)", () => {
    expect(prefKeyLabel("text_scale")).toBe("Text size");
    const motionEntry = parsePrefsSchema({ ok: true, data: SCHEMA_BODY })
      .entries.find((e) => e.key === "motion")!;
    expect(prefValueLabel(motionEntry, "off")).toBe("No motion");
    expect(prefValueLabel(motionEntry, "subtle")).toBe("Subtle motion");
    const targetEntry = parsePrefsSchema({ ok: true, data: SCHEMA_BODY })
      .entries.find((e) => e.key === "target_size")!;
    expect(prefValueLabel(targetEntry, 56)).toBe("56px");
  });
});

// ─── Component behaviour (C2 + a11y floor) ───────────────────────────

function renderRoom() {
  return render(<SettingsRoom />);
}

function section() {
  return screen.getByRole("region", { name: "Customize" });
}

describe("SettingsRoom", () => {
  it("renders one typed control per server key, with current values", () => {
    renderRoom();
    expect(section()).toBeInTheDocument();
    for (const key of Object.keys(SCHEMA_BODY)) {
      expect(document.getElementById(`settings-room-${key}-control`)).not.toBeNull();
    }
    const motion = document.getElementById("settings-room-motion-control") as HTMLSelectElement;
    expect(motion.tagName).toBe("SELECT");
    expect(motion.value).toBe("reduced");
    // Only server-legal values are offered.
    expect(Array.from(motion.options).map((o) => o.value)).toEqual([
      "off", "reduced", "subtle",
    ]);
  });

  it("nothing persists until Apply: a change previews with an undo that works by keyboard", async () => {
    const user = userEvent.setup();
    renderRoom();

    await user.selectOptions(
      screen.getByLabelText(/Motion/i),
      "subtle",
    );

    // C2 preview line: old → proposed, visible as words.
    expect(
      screen.getByText(/Motion: Reduced motion → Subtle motion/),
    ).toBeInTheDocument();
    // Nothing has been written yet.
    expect(mutate).not.toHaveBeenCalled();

    // The undo is a real focusable control, reachable by keyboard.
    const undo = screen.getByRole("button", { name: "Undo change to Motion" });
    undo.focus();
    expect(undo).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(
      screen.queryByText(/Motion: Reduced motion → Subtle motion/),
    ).not.toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("Apply sends ONLY the changed keys and reports what was written", async () => {
    const user = userEvent.setup();
    renderRoom();

    await user.selectOptions(screen.getByLabelText(/Motion/i), "subtle");
    await user.selectOptions(screen.getByLabelText(/Density/i), "compact");
    await user.click(screen.getByRole("button", { name: /Apply changes \(2\)/ }));

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    const body = mutate.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toEqual({ density: "compact", motion: "subtle" });
    expect(
      await screen.findByText(/Saved 2 settings\./),
    ).toBeInTheDocument();
    // The change preview cleared; the applied diff stays visible (C2),
    // listed in server-key order.
    expect(
      screen.getByText(
        "Last apply changed 2 settings: density comfortable→compact · motion reduced→subtle",
      ),
    ).toBeInTheDocument();
  });

  it("applying a pref lands on the document: prefs.py data-attrs and --pw-* vars follow the write (C12)", async () => {
    const user = userEvent.setup();
    renderRoom();
    // Nothing has been applied yet — the room alone must not touch the DOM.
    expect(document.documentElement.getAttribute("data-pw-motion")).toBeNull();

    await user.selectOptions(screen.getByLabelText(/Motion/i), "subtle");
    await user.click(screen.getByRole("button", { name: /Apply changes \(1\)/ }));
    expect(await screen.findByText(/Saved 1 setting\./)).toBeInTheDocument();

    const root = document.documentElement;
    // The write response IS the server's effective table (api.py):
    // every key of it reaches the document, under prefs.py's names.
    expect(root.getAttribute("data-pw-motion")).toBe("subtle");
    expect(root.style.getPropertyValue("--pw-motion")).toBe("subtle");
    expect(root.style.getPropertyValue("--pw-motion-duration")).toBe("200ms");
    expect(root.getAttribute("data-pw-density")).toBe("comfortable");
    expect(root.getAttribute("data-pw-target-size")).toBe("44");
    expect(root.style.getPropertyValue("--pw-target-size")).toBe("44px");
  });

  it("applying 'Reduced motion' marks the document with the reduced tier — no motion budget left", async () => {
    // Start from a NON-reduced server value so this apply is a real
    // change, exactly as the owner would do it.
    mocks.prefsState = {
      isPending: false,
      isError: false,
      error: null,
      data: { ok: true, data: { ...PREFS_BODY, motion: "subtle" } },
    };
    const user = userEvent.setup();
    renderRoom();
    await user.selectOptions(screen.getByLabelText(/Motion/i), "reduced");
    await user.click(screen.getByRole("button", { name: /Apply changes \(1\)/ }));
    expect(await screen.findByText(/Saved 1 setting\./)).toBeInTheDocument();

    const root = document.documentElement;
    expect(root.getAttribute("data-pw-motion")).toBe("reduced");
    expect(root.style.getPropertyValue("--pw-motion-duration")).toBe("0ms");
    expect(root.style.getPropertyValue("--pw-motion-ambient")).toBe("0");
  });

  it("a refused write changes nothing on the document — application is never faked", async () => {
    mutate.mockImplementationOnce(
      (_body: Record<string, string | number>, options?: { onError?: (e: Error) => void }) => {
        options?.onError?.(new Error("Saving settings requires re-authentication."));
      },
    );
    const user = userEvent.setup();
    renderRoom();
    await user.selectOptions(screen.getByLabelText(/Motion/i), "off");
    await user.click(screen.getByRole("button", { name: /Apply changes \(1\)/ }));
    expect(
      await screen.findByText(/requires re-authentication/),
    ).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-pw-motion")).toBeNull();
    expect(
      document.documentElement.style.getPropertyValue("--pw-motion"),
    ).toBe("");
  });

  it("without step-up the room says why it is read-only — no fake write affordance", () => {
    mocks.sessionState = {
      isPending: false,
      isError: false,
      error: null,
      data: {
        ok: true,
        data: {
          principal_id: "person:operator",
          auth_method: "instance-token",
          has_step_up: false,
        },
      },
    };
    renderRoom();
    expect(
      screen.getByText(/Read-only right now: saving settings requires re-authentication/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apply changes/ })).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("an unusable schema entry becomes a read-only row with a plain sentence", async () => {
    mocks.schemaState = {
      isPending: false,
      isError: false,
      error: null,
      data: {
        ok: true,
        data: { ...SCHEMA_BODY, warp_field: { type: "vibes" } },
      },
    };
    renderRoom();
    expect(
      screen.getByText(/Read-only: the station described this setting in a shape this view does not understand/),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/^Warp field$/i),
    ).not.toBeInTheDocument();
  });

  it("a schema request failure says so instead of rendering invented controls", () => {
    mocks.schemaState = {
      isPending: false,
      isError: true,
      error: new Error("boom"),
      data: undefined,
    };
    renderRoom();
    expect(
      screen.getByText(/could not describe its settings, so nothing is offered for editing/),
    ).toBeInTheDocument();
    expect(
      document.getElementById("settings-room-motion-control"),
    ).toBeNull();
  });

  it("shows the honest unwired label for the language dials in one place (C10)", () => {
    renderRoom();
    expect(screen.getByText(/language dials — not yet wired/)).toBeInTheDocument();
  });
});

// ─── companion_id: the crew is the vocabulary (owner 2026-09-25/26) ──

describe("SettingsRoom — companion", () => {
  const WITH_COMPANION_ID = {
    ...SCHEMA_BODY,
    companion_id: {
      type: "companion_id", default: null, floor: null, allowed: null,
      integer: false, unit: "", note: "a companion id from the caller's own crew",
    },
  };

  function useCompanionSchema(companionId: string | null) {
    mocks.schemaState = { ...mocks.schemaState, data: { ok: true, data: WITH_COMPANION_ID } };
    mocks.prefsState = {
      ...mocks.prefsState,
      data: { ok: true, data: { ...PREFS_BODY, companion_id: companionId } },
    };
    mocks.crewState = {
      isPending: false,
      isError: false,
      data: {
        ok: true,
        data: [
          { id: "renai", name: "Renai", source: "starter", hidden: false },
          { id: "pip", name: "Pip", source: "user", hidden: false },
          { id: "hekek", name: "Hekek", source: "starter", hidden: true },
        ],
      },
    };
  }

  it("offers the Assistant plus your unhidden crew, and retires the old companion row", () => {
    useCompanionSchema(null);
    renderRoom();
    expect(document.getElementById("settings-room-companion-control")).toBeNull();
    const select = screen.getByLabelText("Companion") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      "Assistant (default, the plain voice)",
      "Renai",
      "Pip",
    ]);
  });

  it("saves the Assistant as null and a companion by crew id", async () => {
    const user = userEvent.setup();
    useCompanionSchema("renai");
    renderRoom();
    await user.selectOptions(screen.getByLabelText("Companion"), "");
    await user.click(screen.getByRole("button", { name: /Apply changes \(1\)/ }));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate.mock.calls[0][0]).toEqual({ companion_id: null });
  });
});
