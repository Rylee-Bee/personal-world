/**
 * Tests for the Bridge — the home screen (contract worlds-briefing/1,
 * slice 1b "first light").
 *
 * Pattern (same philosophy as overview-home-loop.test.tsx): the data
 * layer is mocked at the hooks boundary, the fixture IS the server
 * vocabulary, and the assertions are the honesty floor plus the a11y
 * floor (spoken map labels, text-carried status, a calm tray, keyboard
 * reachable bodies).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── Mocked data boundary ────────────────────────────────────────────

const { hookState, mutate } = vi.hoisted(() => ({
  hookState: {
    briefing: {
      isPending: false,
      isError: false,
      error: undefined as unknown,
      refetch: () => Promise.resolve(),
      data: undefined as unknown,
    },
    place: { isPending: false, isError: false, data: undefined as unknown },
    rooms: {
      isPending: false,
      isError: false,
      error: undefined as unknown,
      data: undefined as unknown,
    },
    // Pending by default: the first-day guide waits for real data, so the
    // Bridge tests below see the Bridge alone; the guide has its own.
    journal: { isPending: true, data: undefined as unknown },
  },
  mutate: vi.fn(),
}));

vi.mock("../data/hooks", () => ({
  useBriefing: () => hookState.briefing,
  usePlace: () => hookState.place,
  useSetPlace: () => ({ mutate }),
  useRooms: () => hookState.rooms,
  useJournalList: () => hookState.journal,
}));

import { Bridge } from "../screens/Bridge/Bridge";

// ─── Fiction fixture — the server vocabulary, not a mock of the UI ────

function item(system: string, id: string, kind: string, title: string, isNew = false) {
  return {
    id,
    system,
    kind,
    title,
    detail: `${title} — detail.`,
    at: "2026-09-25T08:30:00Z",
    new: isNew,
    link: null,
  };
}

function system(
  id: string,
  name: string,
  residentName: string,
  status: string,
  voice: string,
  arrivals: number,
  haveTos: number,
  items: unknown[] = [],
) {
  return {
    id,
    name,
    resident: { key: residentName.toLowerCase(), name: residentName, portrait: `/assets/characters/${id}.png` },
    status,
    voice,
    counts: { arrivals, have_tos: haveTos },
    source: { name: `${name} source`, observed_at: "2026-09-25T08:45:00Z", freshness: "fresh" },
    items,
  };
}

const SYSTEM_LIST = [
  system("agents", "Workshop", "Bolt", "healthy", "Two things on the bench still want a look.", 2, 2, [
    item("agents", "agents:one", "have_to", "Review the contract bump", true),
    item("agents", "agents:two", "arrival", "Polish the onboarding copy"),
  ]),
  system("estate", "Engine room", "Hekek", "warning", "A patch will hold until a proper repair.", 1, 2, [
    item("estate", "estate:one", "have_to", "The backup volume is nearly full", true),
  ]),
  system("records", "Archive", "Bruma", "healthy", "I kept your last note safe.", 1, 1, [
    item("records", "records:one", "have_to", "A record wants a second look"),
  ]),
  system("interests", "Observatory", "Mira", "healthy", "I noticed a pattern in what you've been reading.", 0, 0, []),
  system("news", "Newsstand", "Burrito Journalism", "not_configured", "No feed plugged in yet — nothing to report, honestly.", 0, 0, []),
  system("threads", "World tree", "Ratatoskr", "unavailable", "The branch I climb is out of reach right now.", 0, 0, []),
];

const HAVE_TOS = [
  item("agents", "agents:one", "have_to", "Review the contract bump", true),
  item("estate", "estate:one", "have_to", "The backup volume is nearly full", true),
  item("records", "records:one", "have_to", "A record wants a second look"),
];

const BRIEFING = {
  ok: true,
  status: "needs_attention",
  data: {
    schema: "worlds-briefing/1",
    generated_at: "2026-09-25T09:00:00Z",
    since: "2026-09-24T17:00:00Z",
    keeper: {
      line: "Two things need you, and the Workshop has been busy.",
      mood: "busy",
      resident: { key: "assistant", name: "Assistant", portrait: "/assets/crew/assistant.svg" },
    },
    systems: SYSTEM_LIST,
    // Five total, three shown — the tray cap under test.
    have_tos: HAVE_TOS,
    have_tos_total: 5,
    arrivals: [item("agents", "agents:two", "arrival", "Polish the onboarding copy")],
    thread: null,
  },
};

beforeEach(() => {
  mutate.mockClear();
  hookState.briefing = {
    isPending: false,
    isError: false,
    error: undefined,
    refetch: () => Promise.resolve(),
    data: BRIEFING,
  };
  hookState.place = { isPending: false, isError: false, data: { ok: true, data: { place: null } } };
  hookState.rooms = {
    isPending: false,
    isError: false,
    error: undefined,
    data: { ok: true, data: [] },
  };
});

afterEach(() => cleanup());

describe("Bridge — the world at a glance", () => {
  it("renders every system with its resident's spoken label", () => {
    render(<Bridge onOpenArea={() => {}} onOpenAssistant={() => {}} />);

    // Map bodies are buttons whose label names system, resident, and the
    // honest status word + counts.
    expect(
      screen.getByRole("button", {
        name: "Workshop — Bolt — Healthy, 2 new, 2 need you",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Newsstand — Burrito Journalism — Not configured, 0 new, 0 need you",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "World tree — Ratatoskr — Unavailable, 0 new, 0 need you",
      }),
    ).toBeInTheDocument();

    // The lenses list names each system too.
    const lenses = screen.getByRole("navigation", { name: "World lenses" });
    expect(lenses).toBeInTheDocument();
    for (const s of SYSTEM_LIST) {
      expect(screen.getByRole("button", { name: `${s.name} — ${statusWordOf(s.status)}` })).toBeInTheDocument();
    }

    // The Keeper speaks the briefing line in the footer status line.
    expect(
      screen.getByText(/Two things need you, and the Workshop has been busy\./),
    ).toBeInTheDocument();
  });

  it("opens on the system with the most new arrivals", () => {
    render(<Bridge onOpenArea={() => {}} onOpenAssistant={() => {}} />);
    const panel = screen.getByRole("complementary", { name: "Briefing panel" });
    expect(panel).toHaveTextContent("Workshop");
    expect(panel).toHaveTextContent("Bolt");
    // A never-writes-on-open contract: the world's own choice is not hers.
    expect(mutate).not.toHaveBeenCalled();
  });

  it("credits the plain voice to Worlds with Sol's mark, and a picture-less companion with the commbadge", () => {
    const withSpeaker = (resident: { key: string | null; name: string; portrait: string | null }) => ({
      ...BRIEFING,
      data: { ...BRIEFING.data, keeper: { ...BRIEFING.data.keeper, resident } },
    });
    hookState.briefing = { ...hookState.briefing, data: withSpeaker({ key: null, name: "Worlds", portrait: null }) };
    const { container, unmount } = render(<Bridge onOpenArea={() => {}} onOpenAssistant={() => {}} />);
    const srcs = () => Array.from(container.querySelectorAll("img")).map((i) => i.getAttribute("src") ?? "");
    expect(srcs().some((s) => s.endsWith("assets/crew/256/sol-mark.webp"))).toBe(true);
    unmount();

    hookState.briefing = { ...hookState.briefing, data: withSpeaker({ key: "pip", name: "Pip", portrait: null }) };
    const second = render(<Bridge onOpenArea={() => {}} onOpenAssistant={() => {}} />);
    const imgs = Array.from(second.container.querySelectorAll("img")).map((i) => i.getAttribute("src") ?? "");
    expect(imgs.some((s) => s.endsWith("assets/crew/256/sol-badge.webp"))).toBe(true);
    expect(imgs.some((s) => s.endsWith("sol-mark.webp"))).toBe(false);
  });

  it("caps the Needs-you tray at three and counts the rest quietly", () => {
    render(<Bridge onOpenArea={() => {}} onOpenAssistant={() => {}} />);
    const tray = screen.getByRole("region", { name: "Needs you" });
    expect(tray.querySelectorAll("li")).toHaveLength(3);
    expect(tray).toHaveTextContent("Review the contract bump");
    expect(tray).toHaveTextContent("A record wants a second look");
    expect(tray).toHaveTextContent("and 2 more, quietly waiting");
  });

  it("renders the room-derived needs in the Needs-you box", () => {
    // The backend composes a matched room (workshop -> the Workshop
    // system) into the briefing: the system's status and count come
    // from the room, and its needs join the top-level tray. The Bridge
    // just renders that truth — a healthy Workshop with 32 needs, never
    // "not set up yet" beside a Rooms panel that says otherwise.
    const roomItem = item(
      "agents",
      "agents:room-need-1",
      "have_to",
      "Fix the bench light",
      true,
    );
    hookState.briefing = {
      isPending: false,
      isError: false,
      error: undefined,
      refetch: () => Promise.resolve(),
      data: {
        ...BRIEFING,
        status: "needs_attention",
        data: {
          ...BRIEFING.data,
          systems: BRIEFING.data.systems.map((s) =>
            s.id === "agents"
              ? {
                  ...s,
                  status: "healthy",
                  counts: { arrivals: 0, have_tos: 32 },
                  items: [roomItem],
                }
              : s,
          ),
          have_tos: [roomItem],
          have_tos_total: 32,
        },
      },
    };
    render(<Bridge onOpenArea={() => {}} onOpenAssistant={() => {}} />);

    const tray = screen.getByRole("region", { name: "Needs you" });
    expect(tray).toHaveTextContent("Fix the bench light");
    expect(tray).toHaveTextContent("and 31 more, quietly waiting");
    // The map no longer contradicts the room: healthy, with its count.
    expect(
      screen.getByRole("button", {
        name: "Workshop — Bolt — Healthy, 0 new, 32 need you",
      }),
    ).toBeInTheDocument();
  });

  it("shows a not_configured system's honest voice, never a fake item", async () => {
    render(<Bridge onOpenArea={() => {}} onOpenAssistant={() => {}} />);
    // The Newsstand lens (name + status word).
    await userEvent.click(
      screen.getByRole("button", { name: "Newsstand — Not configured" }),
    );
    const panel = screen.getByRole("complementary", { name: "Briefing panel" });
    expect(panel).toHaveTextContent("Status: Not configured");
    expect(panel).toHaveTextContent(
      "No feed plugged in yet — nothing to report, honestly.",
    );
    expect(panel).toHaveTextContent("Nothing to show here yet.");
  });

  it("remembers a chosen system with one debounced place write", async () => {
    render(<Bridge onOpenArea={() => {}} onOpenAssistant={() => {}} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Archive — Healthy" }),
    );
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1), { timeout: 2500 });
    expect(mutate).toHaveBeenCalledWith({ system: "records", item_id: null });
  });

  it("selects a system from the map by keyboard", async () => {
    render(<Bridge onOpenArea={() => {}} onOpenAssistant={() => {}} />);
    const body = screen.getByRole("button", {
      name: "Engine room — Hekek — Warning, 1 new, 2 need you",
    });
    body.focus();
    expect(body).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    const panel = screen.getByRole("complementary", { name: "Briefing panel" });
    expect(panel).toHaveTextContent("Engine room");
    expect(panel).toHaveTextContent("Warning");
  });

  it("says the world is unreachable, with a retry, when the briefing fails", async () => {
    const refetch = vi.fn(() => Promise.resolve());
    hookState.briefing = {
      isPending: false,
      isError: true,
      error: new Error("station did not answer"),
      refetch,
      data: undefined,
    };
    render(<Bridge onOpenArea={() => {}} onOpenAssistant={() => {}} />);
    expect(
      screen.getByText("Couldn't reach your world right now."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("gathers the world while loading — no invented rows", () => {
    hookState.briefing = {
      isPending: true,
      isError: false,
      error: undefined,
      refetch: () => Promise.resolve(),
      data: undefined,
    };
    render(<Bridge onOpenArea={() => {}} onOpenAssistant={() => {}} />);
    expect(screen.getByText("Gathering your world…")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "World lenses" })).toBeNull();
  });
});

/** The UI's own status vocabulary, mirrored here so the fixture's raw
 *  status strings are asserted against words, not tokens. */
function statusWordOf(raw: string): string {
  const words: Record<string, string> = {
    healthy: "Healthy",
    warning: "Warning",
    needs_attention: "Needs attention",
    unavailable: "Unavailable",
    stale: "Stale",
    disabled: "Disabled",
    not_configured: "Not configured",
    unknown: "Unknown",
  };
  return words[raw] ?? "Unknown";
}
// ─── The first-day guide (FirstBridge board) ─────────────────────────

describe("Bridge — first day aboard", () => {
  function firstDay(opts: {
    rooms?: unknown[];
    notes?: Array<{ source: string }>;
    resident?: { key: string | null; name: string; portrait: string | null };
    name?: string | null;
  }) {
    hookState.rooms = {
      isPending: false,
      isError: false,
      error: undefined,
      data: { ok: true, data: opts.rooms ?? [] },
    };
    hookState.journal = {
      isPending: false,
      data: {
        ok: true,
        data: (opts.notes ?? []).map((n, i) => ({
          ts: `2026-09-25T0${i}:00:00Z`,
          kind: "observation",
          summary: "x",
          provenance: { source: n.source },
        })),
      },
    };
    hookState.briefing = {
      ...hookState.briefing,
      data: {
        ...BRIEFING,
        data: {
          ...BRIEFING.data,
          keeper: {
            ...BRIEFING.data.keeper,
            name: opts.name ?? null,
            resident: opts.resident ?? { key: "renai", name: "Renai", portrait: null },
          },
        },
      },
    };
  }

  afterEach(() => {
    window.localStorage.removeItem("pw-first-day-guide");
    hookState.journal = { isPending: true, data: undefined };
  });

  it("welcomes the person in their companion's voice, with every line live and in words", () => {
    firstDay({ name: "Rylee", notes: [{ source: "setup-wizard" }] });
    render(<Bridge onOpenArea={() => {}} onOpenAssistant={() => {}} onOpenCrew={() => {}} />);
    const guide = screen.getByRole("region", { name: "Welcome aboard, Rylee." });
    expect(within(guide).getByText("Renai:")).toBeInTheDocument();
    expect(within(guide).getByText("No rooms yet")).toBeInTheDocument();
    // Setup's own journal entry is not the person's first note.
    expect(within(guide).getByText("Not yet")).toBeInTheDocument();
    expect(within(guide).getByText("Done · Renai is your companion")).toBeInTheDocument();
    expect(within(guide).getByRole("button", { name: "How rooms connect" })).toHaveAttribute("aria-expanded", "false");
  });

  it("speaks in Worlds' plain voice with Sol's mark when the crew is off, and drops the crew line", () => {
    firstDay({ resident: { key: null, name: "Worlds", portrait: null } });
    const { container } = render(<Bridge onOpenArea={() => {}} onOpenAssistant={() => {}} />);
    const guide = screen.getByRole("region", { name: "Welcome aboard." });
    expect(within(guide).getByText("Worlds:")).toBeInTheDocument();
    expect(within(guide).queryByText(/Meet your crew/)).not.toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll("img")).some((i) => i.getAttribute("src")?.endsWith("sol-mark.webp")),
    ).toBe(true);
  });

  it("stays put away once put away, on this device", () => {
    firstDay({});
    render(<Bridge onOpenArea={() => {}} onOpenAssistant={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Put this away" }));
    expect(screen.queryByRole("region", { name: /Welcome aboard/ })).not.toBeInTheDocument();
    expect(window.localStorage.getItem("pw-first-day-guide")).toBe("hidden");
  });

  it("isn't shown while it can't yet tell what's done", () => {
    firstDay({});
    hookState.journal = { isPending: true, data: undefined };
    render(<Bridge onOpenArea={() => {}} onOpenAssistant={() => {}} />);
    expect(screen.queryByRole("region", { name: /Welcome aboard/ })).not.toBeInTheDocument();
  });

  it("says an unreachable system as a count, not a lone alarm word", () => {
    firstDay({});
    hookState.briefing = {
      ...hookState.briefing,
      data: {
        ...BRIEFING,
        status: "unavailable",
        data: {
          ...BRIEFING.data,
          systems: SYSTEM_LIST.map((s, i) => ({ ...s, status: i === 0 ? "unavailable" : "healthy" })),
        },
      },
    };
    render(<Bridge onOpenArea={() => {}} onOpenAssistant={() => {}} />);
    expect(screen.getByText("1 system can’t be reached")).toBeInTheDocument();
  });
});
