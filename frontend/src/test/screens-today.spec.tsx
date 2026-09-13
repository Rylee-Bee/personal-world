import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, fireEvent, within, render } from "@testing-library/react";
import { axe } from "vitest-axe";
import TodayScreen, { NotificationCard } from "../screens/TodayScreen";
import {
  screenProviders,
  mockFetchByRoute,
  jsonResponse,
  okEnvelope,
  CAPABILITIES_FIXTURE,
  JOURNAL_ENTRY_FIXTURE,
} from "./screen-helpers";
import { toHaveNoViolations } from "vitest-axe/dist/matchers";
import type { JournalEntry } from "../lib/api";

/**
 * T10 Today spec (parity rows 1–3, FOUNDATION-SPEC §7):
 * - renders real API data only (status/daily/journal/apps/lab);
 * - a quiet day (no digest actions) renders NO "what changed" list;
 * - the services add flow goes through PUT /api/apps (step-up path);
 * - keyboard-only add flow works;
 * - axe: 0 violations (color-contrast disabled — tokens own contrast);
 * - T14 warmth: greeting + real h2 headings (no card chrome), the
 *   "available:" shape humanized in What changed too, quiet
 *   capability grouping (problems surfaced, healthy majority behind
 *   one honest count), and the fresh-install health sentence.
 */

expect.extend({ toHaveNoViolations });

const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

const DAILY_BUSY = {
  ok: true,
  status: "healthy",
  warnings: ["reasoning: unavailable"],
  actions: [
    "drift: focus: 'resting' != intent 'shipping'",
    "available: forge-probe (source_control) — not enabled for writes",
  ],
  data: {
    world: { facts: 3, intents: 1, policies: 1, cemented_policies: 0, capabilities: 3, providers: 2, packs: 0 },
    capabilities: CAPABILITIES_FIXTURE,
    // The daily loop's digest: attention = warnings + actions (loop.py).
    attention: [
      "reasoning: unavailable",
      "drift: focus: 'resting' != intent 'shipping'",
      "available: forge-probe (source_control) — not enabled for writes",
    ],
  },
};

const DAILY_QUIET = {
  ok: true,
  status: "healthy",
  warnings: [],
  actions: [],
  data: {
    world: { facts: 3, intents: 1, policies: 1, cemented_policies: 0, capabilities: 3, providers: 2, packs: 0 },
    capabilities: CAPABILITIES_FIXTURE,
    attention: [],
  },
};

/** A fresh install: every capability not_configured (a valid,
 * non-error state per NATIVE-BASELINE-AND-ENRICHMENT). */
const DAILY_FRESH = {
  ok: true,
  status: "healthy",
  warnings: [],
  actions: [],
  data: {
    world: { facts: 0, intents: 0, policies: 0, cemented_policies: 0, capabilities: 2, providers: 0, packs: 0 },
    capabilities: {
      source_control: { ok: false, status: "not_configured", warnings: [], last_observed: "2026-09-11T05:00:00Z" },
      media: { ok: false, status: "not_configured", warnings: [], last_observed: "2026-09-11T05:00:00Z" },
    },
    attention: [],
  },
};

const NOTE_ENTRY = {
  ts: "2026-09-11T06:30:00Z",
  kind: "observation",
  summary: "Replaced the garage door sensor battery",
  provenance: {
    source: "user",
    observed_at: "2026-09-11T06:30:00Z",
    provider: null,
    authority: "observed",
  },
  classification: "private",
};

function defaultHandlers(overrides: Record<string, unknown> = {}) {
  return {
    "/api/daily": () => jsonResponse(200, overrides.daily ?? DAILY_BUSY),
    "/api/projects/status": () =>
      overrides.projectsStatus !== undefined
        ? jsonResponse(200, overrides.projectsStatus)
        : jsonResponse(200, {
            ok: true,
            status: "healthy",
            warnings: [],
            data: { observed_at: "2026-09-12T12:48:38Z", projects: [] },
          }),
    "/api/journal": (path: string, init?: RequestInit) => {
      const n = Number(new URL(path, "http://x").searchParams.get("n") ?? "20");
      const entries = (overrides.journal as JournalEntry[] | undefined) ?? [
        NOTE_ENTRY,
        JOURNAL_ENTRY_FIXTURE,
        { ...JOURNAL_ENTRY_FIXTURE, ts: "2026-09-11T03:00:00Z", summary: "capability media: not_configured" },
      ];
      if (init?.method === "POST") {
        return jsonResponse(200, { ok: true, data: { written: 5 } });
      }
      return jsonResponse(200, { ok: true, data: entries.slice(0, n) });
    },
    "/api/apps": (_path: string, _init?: RequestInit) => okEnvelope(overrides.apps ?? []),
    "/api/lab/state": () =>
      overrides.lab !== undefined
        ? jsonResponse(200, overrides.lab)
        : jsonResponse(200, {
            ok: true,
            status: "healthy",
            data: {
              rows: [
                {
                  row: "review",
                  count: 1,
                  stale: false,
                  observations: [
                    {
                      detail: "provider credit balance 45% /used 132 of window resets in 3 days",
                      action: null,
                      state: "REVIEW",
                      observed_at: "2026-09-11T04:50:00Z",
                    },
                  ],
                },
              ],
              schema: "lab-lowbw/1",
              generated_at: "2026-09-11T05:00:00Z",
            },
          }),
    "/api/sections": () => okEnvelope({ schema: "personal-world/sections/1", sections: [] }),
  };
}

beforeEach(() => {
  localStorage.setItem("pw_token", "test-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function bootToday(handlers: Parameters<typeof mockFetchByRoute>[0]) {
  mockFetchByRoute(handlers);
  const utils = screenProviders(<TodayScreen />);
  await waitFor(() => {
    // All four read queries settled: the health sentence is rendered
    // (digest done) AND the journal panel shows either entries or its
    // honest empty state (no "Opening…" spinners remain).
    expect(screen.queryByText(/Checking your world…/)).toBeNull();
    expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    expect(screen.queryByText(/Opening your services…/)).toBeNull();
    expect(screen.queryByText(/Checking usage…/)).toBeNull();
  });
  return utils;
}

describe("TodayScreen (T10, parity rows 1–3)", () => {
  it("renders the health sentence from real capability counts", async () => {
    await bootToday(defaultHandlers());
    expect(
      screen.getByText(/1 thing needs a look\. 1 capability is healthy\./)
    ).toBeTruthy();
  });

  it("renders the attention list from /api/daily attention", async () => {
    await bootToday(defaultHandlers());
    // The DAILY_BUSY fixture has 2+ actionable items, so it renders
    // the Bad Day triage (17:2117) instead of the plain attention list.
    expect(screen.getByText("What needs you now")).toBeTruthy();
    expect(screen.getByText("Needs attention")).toBeTruthy();
    // The humanized sentences appear in both the triage and "What changed"
    expect(screen.getAllByText(/Reasoning: unavailable/).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/Source control is ready for looking, not changing things\./).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("a quiet day shows NO what-changed list (no fabricated Recent Changes) and renders the quiet companion message (frame 17:481)", async () => {
    await bootToday(defaultHandlers({ daily: DAILY_QUIET }));
    expect(screen.queryByText("What changed")).toBeNull();
    expect(screen.queryByText("Recent Changes")).toBeNull();
    // Workshop v3 (17:522): the quiet state's exact canonical line —
    // the world carries the monitoring burden; no tasks are invented.
    expect(screen.getByText("Nothing needs you right now.")).toBeTruthy();
    expect(
      screen.getByText("Your world is running on its own. You can check on it anytime.")
    ).toBeTruthy();
    // the companion is decorative artwork inside the quiet block,
    // never a trigger (A11y §7.2) and removable via the pref (§7.4)
    const quiet = document.querySelector("[data-pw-today-quiet]");
    expect(quiet).toBeTruthy();
    const slot = quiet?.querySelector("[data-pw-companion-slot]");
    expect(slot?.querySelector("button")).toBeNull();
  });

  it("uncertainty-only attention renders the Question region (frame 17:6245) with real capability data — never a fabricated story", async () => {
    // The real shape that reaches the Question state: a capability
    // observed "unknown" (registry.observe fail-closed vocabulary).
    const DAILY_QUESTION = {
      ok: true,
      status: "healthy",
      warnings: ["ingress: unknown"],
      actions: [],
      data: {
        world: { facts: 3, intents: 1, policies: 1, cemented_policies: 0, capabilities: 3, providers: 2, packs: 0 },
        capabilities: {
          ...CAPABILITIES_FIXTURE,
          ingress: {
            ok: false,
            status: "unknown",
            warnings: ["ingress rollup could not be read — the observation timed out"],
            last_observed: "2026-09-11T05:00:00Z",
          },
        },
        attention: ["ingress: unknown"],
      },
    };
    await bootToday(defaultHandlers({ daily: DAILY_QUESTION }));
    // canonical heading (17:6298), reassurance (17:6300), and the
    // italic de-escalation (17:6301) — the world stays curious, not
    // alarmed, and uncertainty is not failure.
    expect(
      screen.getByRole("heading", { name: /Something caught my attention\./, level: 2 })
    ).toBeTruthy();
    expect(screen.getByText("I'll keep watching. It might resolve on its own.")).toBeTruthy();
    expect(
      screen.getByText("This isn't a problem yet — just something I noticed.")
    ).toBeTruthy();
    // The sentence names the REAL capability (humanized), not the
    // frame's sample DNS story (row 15: no fabricated content).
    expect(screen.getByText(/ingress has not been checked yet/)).toBeTruthy();
    expect(screen.queryByText(/DNS propagation/)).toBeNull();
    // Evidence chip: "✦ What I can see" exposes the REAL warning behind
    // the Level-4 disclosure (A11y §4.6), never an invented line.
    const evidence = screen.getByText("✦ What I can see");
    expect(evidence).toBeTruthy();
    // companion present, decorative, not a trigger (A11y §7.2)
    const region = document.querySelector("[data-pw-today-question]");
    expect(region).toBeTruthy();
    const slot = region?.querySelector("[data-pw-companion-slot]");
    expect(slot?.querySelector("button")).toBeNull();
    // axe holds in the question state too
    const results = await axeNoContrast(document.body);
    expect(results).toHaveNoViolations();
  });

  it("mixed attention (uncertainty + actionable) keeps the restrained list — a real problem is never softened into a question", async () => {
    const DAILY_MIXED = {
      ok: true,
      status: "healthy",
      warnings: ["ingress: unknown"],
      actions: ["drift: focus: 'resting' != intent 'shipping'"],
      data: {
        world: { facts: 3, intents: 1, policies: 1, cemented_policies: 0, capabilities: 3, providers: 2, packs: 0 },
        capabilities: {
          ...CAPABILITIES_FIXTURE,
          ingress: {
            ok: false,
            status: "unknown",
            warnings: ["ingress rollup could not be read — the observation timed out"],
            last_observed: "2026-09-11T05:00:00Z",
          },
        },
        attention: ["ingress: unknown", "drift: focus: 'resting' != intent 'shipping'"],
      },
    };
    await bootToday(defaultHandlers({ daily: DAILY_MIXED }));
    expect(screen.queryByText(/Something caught my attention\./)).toBeNull();
    expect(screen.getByRole("heading", { name: "Attention", level: 2 })).toBeTruthy();
  });

  it("a busy day renders the real what-changed items verbatim in the Recent Changes panel (17:533)", async () => {
    await bootToday(defaultHandlers());
    expect(screen.getByRole("heading", { name: "Recent Changes", level: 2 })).toBeTruthy();
    expect(screen.getByText(/drift: focus/)).toBeTruthy();
  });

  it("renders recent journal entries from /api/journal and filters loop noise", async () => {
    await bootToday(defaultHandlers());
    expect(screen.getByText("Replaced the garage door sensor battery")).toBeTruthy();
    // capability self-observations are filtered out of "Recent entries"
    const recent = screen.getByRole("list", { name: /recent entries/i });
    expect(recent.textContent).not.toContain("capability source_control: healthy");
  });

  it("journal composer saves through POST /api/journal and clears the box", async () => {
    const handlers = defaultHandlers();
    const journalHandler = handlers["/api/journal"];
    handlers["/api/journal"] = (path, init) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        expect(body.text).toBe("Note from the test");
        return jsonResponse(200, { ok: true, data: { written: body.text.length } });
      }
      return journalHandler(path, init);
    };
    await bootToday(handlers);
    fireEvent.change(screen.getByLabelText("Journal note"), {
      target: { value: "Note from the garage door" },
    });
    fireEvent.change(screen.getByLabelText("Journal note"), {
      target: { value: "Note from the test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Journal note")).toHaveProperty("value", "");
    });
  });

  it("services launcher renders saved services from /api/apps", async () => {
    await bootToday(
      defaultHandlers({
        apps: [
          { id: "forge-probe", name: "Forge Probe", url: "https://git.example.net" },
          { id: "grafana", name: "Grafana", url: "https://metrics.example.net", category: "dashboards" },
        ],
      })
    );
    // Open "More from your world" disclosure to reach the launcher.
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    expect(screen.getByRole("link", { name: /Forge Probe/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Grafana/ })).toBeTruthy();
  });

  it("subscription usage lists real lab packet quota observations, honest when absent", async () => {
    await bootToday(defaultHandlers());
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    expect(
      screen.getByText("provider credit balance 45% /used 132 of window resets in 3 days")
    ).toBeTruthy();
  });

  it("adding a service PUTs the full registry through step-up and the new service appears", async () => {
    const handlers = defaultHandlers({
      apps: [{ id: "forge-probe", name: "Forge Probe", url: "https://git.example.net" }],
    });
    let putCount = 0;
    let savedApps: unknown[] = [
      { id: "forge-probe", name: "Forge Probe", url: "https://git.example.net" },
    ];
    let putHeaders: Headers | null = new Headers();
    handlers["/api/apps"] = (_path: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        putCount += 1;
        putHeaders = new Headers(init.headers);
        if (putCount === 1) {
          // First attempt: elevation required (the transitional P1 flow).
          return jsonResponse(403, { detail: "write requires step-up auth" });
        }
        savedApps = JSON.parse(String(init.body)).apps;
        return jsonResponse(200, { ok: true, data: savedApps });
      }
      // GET reflects the persisted registry (server truth after the PUT).
      return jsonResponse(200, { ok: true, data: savedApps });
    };
    await bootToday(handlers);
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    fireEvent.change(screen.getByLabelText("Service name"), {
      target: { value: "Home Assistant" },
    });
    fireEvent.change(screen.getByLabelText("Service address"), {
      target: { value: "https://ha.example.net" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add service" }));
    // 403 step_up_required opens the StepUpPrompt naming the reason.
    await screen.findByText("Confirm this action");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      const statuses = screen.getAllByRole("status");
      expect(
        statuses.some((el) => /Service added/.test(el.textContent ?? ""))
      ).toBe(true);
    });
    expect(putCount).toBe(2);
    // Both attempts carry the step-up header (single withStepUp path)
    expect(putHeaders?.get("X-PW-StepUp")).toBe("1");
    expect(savedApps).toEqual([
      { id: "forge-probe", name: "Forge Probe", url: "https://git.example.net" },
      { id: "home-assistant", name: "Home Assistant", url: "https://ha.example.net/" },
    ]);
    expect(await screen.findByRole("link", { name: /Home Assistant/ })).toBeTruthy();
  });

  it("keyboard-only add flow works (fill fields via keyboard, activate with Enter)", async () => {
    const handlers = defaultHandlers({ apps: [] });
    let savedApps: unknown[] = [];
    handlers["/api/apps"] = (_path: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        savedApps = JSON.parse(String(init.body)).apps;
        return jsonResponse(200, { ok: true, data: savedApps });
      }
      // GET reflects the persisted registry (server truth after the PUT).
      return jsonResponse(200, { ok: true, data: savedApps });
    };
    await bootToday(handlers);
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    // Keyboard path: focus the name field, type, tab to address, type,
    // tab to the button, activate with Enter (jsdom fires click on
    // button + Enter through fireEvent.keyDown/keypress semantics).
    const name = screen.getByLabelText("Service name");
    const url = screen.getByLabelText("Service address");
    name.focus();
    fireEvent.change(name, { target: { value: "Jellyfin" } });
    url.focus();
    fireEvent.change(url, { target: { value: "http://media.local:8096" } });
    const button = screen.getByRole("button", { name: "Add service" });
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: "Enter", code: "Enter" });
    fireEvent.click(button); // browser synthesizes click on Enter
    await screen.findByRole("link", { name: /Jellyfin/ });
  });

  it("honest empty states when endpoints report not-configured / empty", async () => {
    await bootToday(
      defaultHandlers({
        apps: [],
        daily: DAILY_QUIET,
        journal: [],
        lab: { ok: true, status: "healthy", data: { rows: [], schema: "lab-lowbw/1", generated_at: "" } },
      })
    );
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    expect(screen.getByText("No services saved here yet. Add one when it would be useful.")).toBeTruthy();
    expect(screen.getByText("No journal entries yet. This is a gentle place to begin.")).toBeTruthy();
    expect(screen.getByText("No current subscription limits need your attention.")).toBeTruthy();
  });

  it("digest failure renders the honest error naming what failed (A11y §4.5)", async () => {
    mockFetchByRoute({
      "/api/daily": () => jsonResponse(500, { detail: "digest exploded" }),
      "/api/journal": () => jsonResponse(200, { ok: true, data: [] }),
      "/api/apps": () => okEnvelope([]),
      "/api/lab/state": () => jsonResponse(200, { ok: false, status: "unavailable" }),
    });
    screenProviders(<TodayScreen />);
    await screen.findByText(/could not load your daily digest/);
    expect(screen.getByText(/digest exploded/)).toBeTruthy();
    expect(screen.getByText(/rest of your world still works/)).toBeTruthy();
  });

  it("capabilities rows carry canonical StatusChip words + provenance disclosure", async () => {
    await bootToday(defaultHandlers());
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    // The healthy/not_configured majority now sits behind the quiet
    // disclosure — open it first (the real reachable path to those rows).
    fireEvent.click(screen.getByText("Show the other 2"));
    const chips = screen.getAllByText("not configured");
    expect(chips.length).toBeGreaterThan(0);
    const chip = chips[0].closest(".chip");
    expect(chip?.getAttribute("data-status")).toBe("not_configured");
    // per-row provenance: disclosure reveals the raw payload (L4)
    fireEvent.click(screen.getAllByText("source control")[0]);
    await waitFor(() => {
      expect(screen.getAllByText("Technical details").length).toBeGreaterThan(0);
    });
  });

  it("greets by name when the world knows it (never fabricated), with host-local date — frame 17:509", async () => {
    const { container } = await bootToday(defaultHandlers());
    const region = container.querySelector('section[aria-labelledby="today-health-heading"]');
    expect(region).toBeTruthy();
    // The greeting IS the h1 (17:511): time-of-day warmth; the name
    // only ever comes from /api/identity/principal — the test env has
    // no principal handler, so the honest fallback is the generic form.
    const h1 = region?.querySelector("h1");
    expect(h1?.textContent).toMatch(/^Good (morning|afternoon|evening)\.($| ✦$)/);
    const date = region?.querySelector("time");
    expect(date).toBeTruthy();
    expect(date?.getAttribute("dateTime")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((date?.textContent ?? "").length).toBeGreaterThan(0);
  });

  it("sections are real h2 headings inside the v3 panels — no card chrome (A11y §4.1, frame 17:533/17:546)", async () => {
    const { container } = await bootToday(defaultHandlers());
    const h1s = container.querySelectorAll("h1");
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent).toMatch(/^Good (morning|afternoon|evening)\./);
    // the two activity panels carry real h2 headings (17:535/17:547)
    for (const id of ["today-changes-heading", "today-journal-heading"]) {
      const h2 = container.querySelector(`h2#${id}`);
      expect(h2, `missing real h2#${id}`).toBeTruthy();
      expect(h2?.closest("section")?.getAttribute("aria-labelledby")).toBe(id);
    }
    // the busy fixture's Attention section renders the Bad Day triage
    // (17:2117) which uses h2#today-bad-day-heading
    expect(container.querySelector("h2#today-bad-day-heading")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Recent entries" })).toBeTruthy();
    // the bordered/shadowed Card boxes are gone from Today
    // (transition-shadow is the Card chrome signature — buttons have
    // shadow-sm/hover:shadow-md but never transition-shadow)
    expect(container.querySelectorAll('[class*="transition-shadow"]').length).toBe(0);
  });

  it("what-changed reads the 'available:' shape in the same humanized voice as Attention (region renamed to 17:533's Recent Changes)", async () => {
    await bootToday(defaultHandlers());
    const changes = screen.getByRole("region", { name: "Recent Changes" });
    expect(
      within(changes).getByText(/Source control is ready for looking, not changing things\./)
    ).toBeTruthy();
    // entries that do not match that shape keep their recorded content verbatim
    expect(within(changes).getByText(/drift: focus: 'resting' != intent 'shipping'/)).toBeTruthy();
    expect(within(changes).queryByText(/available: forge-probe/)).toBeNull();
  });

  it("quiets the healthy majority behind one honest count line; problems stay individual", async () => {
    await bootToday(defaultHandlers());
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    // reasoning (unavailable) is surfaced as its own row
    expect(screen.getByText("reasoning")).toBeTruthy();
    // the healthy/not_configured majority collapsed to one line (real count from the data)
    expect(screen.getByText("2 other capabilities are healthy or not yet connected.")).toBeTruthy();
    // progressive disclosure reveals complexity, it never erases it: the
    // quiet rows are still reachable inside the disclosure
    fireEvent.click(screen.getByText("Show the other 2"));
    expect(screen.getAllByText("source control").length).toBeGreaterThan(0);
    expect(screen.getAllByText("media").length).toBeGreaterThan(0);
  });

  it("a fresh world (everything not yet connected) reads as ready, never '0 are healthy'", async () => {
    await bootToday(defaultHandlers({ daily: DAILY_FRESH }));
    expect(
      screen.getByText(/Your world is ready\. Nothing is connected yet — capabilities will show up here as you add them\./)
    ).toBeTruthy();
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    // nothing surfaced (all quiet), so the count line carries the whole truth
    expect(screen.getByText("2 capabilities are healthy or not yet connected.")).toBeTruthy();
    expect(screen.getByText("Show the other 2")).toBeTruthy();
  });

  it("axe: 0 violations (color-contrast disabled)", async () => {
    const { container } = await bootToday(defaultHandlers());
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("bad day triage (17:2117): 2+ actionable items render the three-tier hierarchy", async () => {
    await bootToday(defaultHandlers());
    // Tier 1: "What needs you now" with rose border
    expect(screen.getByText("What needs you now")).toBeTruthy();
    expect(screen.getByText("Needs attention")).toBeTruthy();
    expect(screen.getByText(/things could use your attention\./)).toBeTruthy();
    // Companion note
    expect(screen.getByText(/I'll keep watching this\./)).toBeTruthy();
    // Reassurance message
    expect(
      screen.getByText("This isn't broken. It's waiting for you when you're ready.")
    ).toBeTruthy();
    // data-pw-today-bad-day attribute present
    const triage = document.querySelector("[data-pw-today-bad-day]");
    expect(triage).toBeTruthy();
    // Companion present in triage, decorative, not a trigger
    const slot = triage?.querySelector("[data-pw-companion-slot]");
    expect(slot?.querySelector("button")).toBeNull();
    // axe holds in the bad day state
    const results = await axeNoContrast(document.body);
    expect(results).toHaveNoViolations();
  });

  it("bad day triage with informational items shows tier 2 'Good to know' section", async () => {
    const DAILY_BAD_DAY_WITH_INFO = {
      ok: true,
      status: "healthy",
      warnings: ["source_control: unavailable", "reasoning: unavailable"],
      actions: ["drift: focus: 'resting' != intent 'shipping'"],
      data: {
        world: { facts: 3, intents: 1, policies: 1, cemented_policies: 0, capabilities: 3, providers: 2, packs: 0 },
        capabilities: CAPABILITIES_FIXTURE,
        attention: [
          "source_control: unavailable",
          "reasoning: unavailable",
          "drift: focus: 'resting' != intent 'shipping'",
          "ingress: unknown",
        ],
      },
    };
    await bootToday(defaultHandlers({ daily: DAILY_BAD_DAY_WITH_INFO }));
    // Tier 1 present
    expect(screen.getByText("What needs you now")).toBeTruthy();
    // Tier 2 present because "ingress: unknown" is informational
    expect(screen.getByText("Good to know — no action needed")).toBeTruthy();
    expect(screen.getByText("Watching quietly")).toBeTruthy();
  });

  it("single actionable item renders the plain attention list, not the triage", async () => {
    const DAILY_SINGLE = {
      ok: true,
      status: "healthy",
      warnings: ["reasoning: unavailable"],
      actions: [],
      data: {
        world: { facts: 3, intents: 1, policies: 1, cemented_policies: 0, capabilities: 3, providers: 2, packs: 0 },
        capabilities: CAPABILITIES_FIXTURE,
        attention: ["reasoning: unavailable"],
      },
    };
    await bootToday(defaultHandlers({ daily: DAILY_SINGLE }));
    // Plain attention list, not triage
    expect(screen.getByRole("heading", { name: "Attention", level: 2 })).toBeTruthy();
    expect(screen.queryByText("What needs you now")).toBeNull();
  });
});

describe("NotificationCard (Workshop v3 17:6369)", () => {
  it("good-news tone: teal border, GOOD NEWS label, heart avatar", () => {
    const { container } = render(
      <NotificationCard tone="good-news" headline="Deploy completed" detail="Your site is live." />
    );
    const card = container.querySelector("[data-pw-notification='good-news']");
    expect(card).toBeTruthy();
    expect(card?.textContent).toContain("GOOD NEWS");
    expect(card?.textContent).toContain("Deploy completed");
    expect(card?.textContent).toContain("Your site is live.");
  });

  it("small-update tone: muted border, A SMALL UPDATE label", () => {
    const { container } = render(
      <NotificationCard tone="small-update" headline="Calendar synced" detail="3 new events this week." />
    );
    const card = container.querySelector("[data-pw-notification='small-update']");
    expect(card).toBeTruthy();
    expect(card?.textContent).toContain("A SMALL UPDATE");
    expect(card?.textContent).toContain("Calendar synced");
  });

  it("action-required tone: rose border, WHEN YOU'RE READY label, persists", () => {
    const { container } = render(
      <NotificationCard tone="action-required" headline="PR needs review" detail="It's been open for 2 days." actionLabel="View PR →" />
    );
    const card = container.querySelector("[data-pw-notification='action-required']");
    expect(card).toBeTruthy();
    expect(card?.textContent).toContain("WHEN YOU'RE READY");
    expect(card?.textContent).toContain("PR needs review");
    expect(card?.textContent).toContain("View PR →");
  });

  it("dismiss button fires onDismiss", () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <NotificationCard tone="good-news" headline="Test" detail="Detail" onDismiss={onDismiss} />
    );
    const btn = container.querySelector("[aria-label='Dismiss notification']");
    expect(btn).toBeTruthy();
    btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("action button fires onAction", () => {
    const onAction = vi.fn();
    const { container } = render(
      <NotificationCard tone="action-required" headline="Test" detail="Detail" actionLabel="View →" onAction={onAction} />
    );
    const btn = container.querySelector("button:not([aria-label])");
    expect(btn?.textContent).toBe("View →");
    btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAction).toHaveBeenCalled();
  });
});
/** One agent-sync project record (mirrors the sensor's model). */
function estateProject(overrides: Record<string, unknown> = {}) {
  return {
    project: "demo",
    path: "/repos/demo",
    is_git_repo: true,
    branch: "main",
    local_head: "aaaaaaa",
    remote_name: "origin",
    remote_url: "https://example.com/acme/demo.git",
    remote_head: "aaaaaaa",
    publish_state: "match",
    working_tree: { staged: 0, modified: 0, untracked: 0, conflicted: 0 },
    play_nice: { present: false, revision: null, source_repository: null },
    work_state: "unknown",
    safe_to_leave: "yes",
    error: null,
    ...overrides,
  };
}

describe("TodayScreen (agent-sync project status)", () => {
  it("all-quiet estate: one settled line, no alarm vocabulary", async () => {
    // Fresh observation (now-2min): NO stale line — Today stays calm
    // when evidence is current (quiet-when-healthy).
    await bootToday(defaultHandlers({
      projectsStatus: {
        ok: true, status: "healthy", warnings: [],
        data: { observed_at: new Date(Date.now() - 2 * 60_000).toISOString(), projects: [estateProject(), estateProject({ project: "second" })] },
      },
    }));
    const region = screen.getByRole("heading", { name: "Projects" }).closest("section");
    expect(region?.textContent).toMatch(/Projects are quiet\./);
    expect(region?.textContent).not.toMatch(/attention|diverged|unpublished/);
    expect(region?.textContent).not.toMatch(/stale|out of date/);
  });

  it("stale quiet estate: ONE calm age line, no error vocabulary", async () => {
    // 47 minutes old: Today says the status MAY be out of date —
    // calm provenance, state itself (quiet) unchanged, no alarm words.
    await bootToday(defaultHandlers({
      projectsStatus: {
        ok: true, status: "healthy", warnings: [],
        data: { observed_at: new Date(Date.now() - 47 * 60_000).toISOString(), projects: [estateProject()] },
      },
    }));
    const region = screen.getByRole("heading", { name: "Projects" }).closest("section");
    expect(region?.textContent).toMatch(/Projects are quiet\./);
    expect(
      screen.getByText(/Project status may be out of date — last observed 47 minutes ago\./)
    ).toBeTruthy();
    expect(region?.textContent).not.toMatch(/ERROR|OUTDATED|DANGER/);
  });

  it("stale attention estate: age line appears BELOW the state lines", async () => {
    // State and freshness are separate dimensions: diverged stays
    // diverged, the age line adds provenance without rewriting it.
    await bootToday(defaultHandlers({
      projectsStatus: {
        ok: true, status: "healthy", warnings: [],
        data: { observed_at: new Date(Date.now() - 47 * 60_000).toISOString(), projects: [estateProject({ project: "split", publish_state: "diverged", safe_to_leave: "no" })] },
      },
    }));
    expect(screen.getByText(/split: local and remote histories have diverged/)).toBeTruthy();
    expect(
      screen.getByText(/Project status was last observed 47 minutes ago\./)
    ).toBeTruthy();
  });

  it("a diverged project surfaces as attention with a human sentence + link", async () => {
    await bootToday(defaultHandlers({
      projectsStatus: {
        ok: true, status: "healthy", warnings: [],
        data: { observed_at: "2026-09-12T12:48:38Z", projects: [estateProject({ project: "split", publish_state: "diverged", safe_to_leave: "no" })] },
      },
    }));
    expect(screen.getByText(/1 needs attention/)).toBeTruthy();
    expect(screen.getByText(/split: local and remote histories have diverged/)).toBeTruthy();
    expect(screen.getByText("See Projects")).toBeTruthy();
  });

  it("local work is mentioned but does NOT over-alarm (no attention vocabulary)", async () => {
    await bootToday(defaultHandlers({
      projectsStatus: {
        ok: true, status: "healthy", warnings: [],
        data: { observed_at: "2026-09-12T12:48:38Z", projects: [estateProject({ project: "vefr", working_tree: { staged: 0, modified: 3, untracked: 1, conflicted: 0 }, safe_to_leave: "published-with-local-work" })] },
      },
    }));
    expect(screen.getByText(/1 has local work/)).toBeTruthy();
    // Project rows carry no attention vocabulary — scoped to the
    // Projects section (the v3 health chip's "attention" count label
    // is a count, not project alarm vocabulary).
    const projects = screen.getByRole("region", { name: /Projects/ });
    expect(projects.textContent).not.toMatch(/attention/);
    expect(screen.queryByText(/diverged/)).toBeNull();
  });

  it("unknown stays honest without stealing attention priority", async () => {
    await bootToday(defaultHandlers({
      projectsStatus: {
        ok: true, status: "healthy", warnings: [],
        data: { observed_at: "2026-09-12T12:48:38Z", projects: [estateProject({ project: "offline", remote_head: null, publish_state: null, safe_to_leave: "unknown" })] },
      },
    }));
    expect(screen.getByText(/1 could not reach its remote/)).toBeTruthy();
    // unknown is a mention, not an attention sentence
    expect(screen.queryByText(/could not be reached, so publication/)).toBeNull();
  });

  it("multiple categories compose in priority order", async () => {
    await bootToday(defaultHandlers({
      projectsStatus: {
        ok: true, status: "healthy", warnings: [],
        data: { observed_at: "2026-09-12T12:48:38Z", projects: [
          estateProject(),
          estateProject({ project: "wip", working_tree: { staged: 1, modified: 0, untracked: 0, conflicted: 0 }, safe_to_leave: "published-with-local-work" }),
          estateProject({ project: "split", publish_state: "diverged", safe_to_leave: "no" }),
        ] },
      },
    }));
    expect(screen.getByText(/1 needs attention · 1 has local work/)).toBeTruthy();
  });

  it("sensor unavailable: Today stays calm (no projects section at all)", async () => {
    await bootToday(defaultHandlers({
      projectsStatus: { ok: false, status: "unavailable", warnings: ["agent-sync observation unavailable"], data: null },
    }));
    expect(screen.queryByText(/Projects are quiet/)).toBeNull();
    expect(screen.queryByText(/needs attention/)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Projects" })).toBeNull();
  });
});
