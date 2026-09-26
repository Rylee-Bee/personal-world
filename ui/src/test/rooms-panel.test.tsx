/**
 * Tests for RoomsPanel — the estate's rooms on the Bridge (contract:
 * room/0) in the Doorways structure (owner direction B, 2026-09-25).
 * The data boundary (useRooms) is mocked; the fixture IS the server
 * vocabulary. The assertions are the honesty floor and the
 * accessibility floor: status as words, unreachable rooms never shown
 * healthy or quiet, the Open links real labelled anchors in a new tab
 * with 44px targets, and decorative art that only appears in its theme.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";

const { hookState } = vi.hoisted(() => ({
  hookState: {
    rooms: {
      isPending: false,
      isError: false,
      error: undefined as unknown,
      data: undefined as unknown,
      refetch: (() => Promise.resolve()) as () => Promise<unknown>,
    },
    visit: vi.fn(),
    markSeen: vi.fn(),
  },
}));

vi.mock("../data/hooks", () => ({
  useRooms: () => hookState.rooms,
  useVisitRoom: () => ({ mutate: hookState.visit }),
  useMarkNeedSeen: () => ({
    mutate: hookState.markSeen,
    isPending: false,
    isError: false,
  }),
}));

import { RoomsPanel } from "../components/RoomsPanel";
import { groupRooms, MAX_DOORWAYS } from "../components/rooms/groupRooms";
import type { RoomRow } from "../data/contract";

function descriptor(name: string, status: string, id = name.toLowerCase()) {
  return {
    contract: "room/0",
    id,
    name,
    icon: "book",
    voice: "dry and precise",
    version: "1.2.0",
    commit: "a1b2c3d",
    status,
    updated_at: "2026-09-25T13:05:48Z",
  };
}

const NOW = new Date().toISOString();

function room(
  id: string,
  name: string,
  status: string,
  needs: Array<{ title: string; created_at?: string }> = [],
  extra: Partial<RoomRow> = {},
): RoomRow {
  return {
    id,
    base_url: `http://127.0.0.1/${id}`,
    reachable: true,
    status,
    room: descriptor(name, status, id),
    needs_you: needs.map((n, i) => ({
      id: `${id}-need-${i}`,
      title: n.title,
      why: `Why ${n.title}.`,
      actions: [],
      created_at: n.created_at ?? "2026-09-25T12:30:00Z",
    })),
    error: null,
    checked_at: NOW,
    last_seen: NOW,
    ...extra,
  };
}

const WORKSHOP = room("workshop", "Workshop", "healthy", [
  { title: "Review an agent's proposed changes", created_at: "2026-09-25T09:00:00Z" },
]);
const PLAYNICE = room("play-nice", "Play-Nice", "healthy", [
  { title: "Approve a contract change", created_at: "2026-09-24T09:00:00Z" },
]);
const DEGRADED = room("studio", "Studio", "degraded");
const QUIET = room("vefr", "VEFR", "healthy");
const UNKNOWN = room("memomancer", "Memomancer", "unknown");
const UNREACHABLE_SEEN = room("cellar", "Cellar", "unreachable", [], {
  reachable: false,
  room: null,
  error: "connect error",
  last_seen: "2026-09-25T12:00:00Z",
});
const UNREACHABLE_NEVER = { ...UNREACHABLE_SEEN, id: "attic", last_seen: null };

function setRooms(data: RoomRow[] | undefined, over: Partial<typeof hookState.rooms> = {}) {
  hookState.rooms = {
    isPending: false,
    isError: false,
    error: undefined,
    data: data === undefined ? undefined : { ok: true, data },
    refetch: () => Promise.resolve(),
    ...over,
  };
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-pw-personality-pack");
  setRooms([WORKSHOP, PLAYNICE, DEGRADED, QUIET, UNKNOWN, UNREACHABLE_SEEN, UNREACHABLE_NEVER]);
});

afterEach(() => cleanup());

describe("groupRooms", () => {
  it("puts rooms that need you in doorways, longest-waiting first", () => {
    const g = groupRooms([WORKSHOP, PLAYNICE, QUIET]);
    expect(g.doorways.map((r) => r.id)).toEqual(["play-nice", "workshop"]);
    expect(g.quiet.map((r) => r.id)).toEqual(["vefr"]);
  });

  it("caps doorways and moves the rest to 'also needs you'", () => {
    const many = Array.from({ length: MAX_DOORWAYS + 2 }, (_, i) =>
      room(`r${i}`, `Room ${i}`, "healthy", [
        { title: `Need ${i}`, created_at: `2026-09-2${i}T09:00:00Z` },
      ]),
    );
    const g = groupRooms(many);
    expect(g.doorways).toHaveLength(MAX_DOORWAYS);
    expect(g.alsoNeeds).toHaveLength(2);
  });

  it("never files an unreachable or unknown room as quiet", () => {
    const g = groupRooms([UNKNOWN, UNREACHABLE_SEEN, QUIET, DEGRADED]);
    expect(g.uncertain.map((r) => r.id)).toEqual(["memomancer", "cellar"]);
    expect(g.quiet.map((r) => r.id)).toEqual(["vefr"]);
    expect(g.other.map((r) => r.id)).toEqual(["studio"]);
  });

  it("ignores an unreachable room's stale needs", () => {
    const stale = { ...UNREACHABLE_SEEN, needs_you: WORKSHOP.needs_you };
    const g = groupRooms([stale]);
    expect(g.doorways).toHaveLength(0);
    expect(g.uncertain).toHaveLength(1);
  });
});

describe("RoomsPanel", () => {
  it("summarises in words and gives each room that needs you a doorway", () => {
    render(<RoomsPanel />);
    const region = screen.getByRole("region", { name: "Rooms" });
    expect(
      within(region).getByText("2 rooms need you · 3 unknown, unreachable or incompatible · 1 quiet."),
    ).toBeInTheDocument();

    const doorway = screen.getByRole("article", { name: "Workshop" });
    expect(within(doorway).getByText("Needs you")).toBeInTheDocument();
    expect(within(doorway).getByText("Review an agent's proposed changes")).toBeInTheDocument();
    expect(within(doorway).getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Play-Nice" })).toBeInTheDocument();
  });

  it("shows status as a word for every room, never colour alone", () => {
    render(<RoomsPanel />);
    expect(screen.getByText("Degraded")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getAllByText("Unreachable")).toHaveLength(2);
  });

  it("renders an unreachable room with last-seen, never as healthy or quiet", () => {
    render(<RoomsPanel />);
    expect(screen.getByText(/^unreachable · last seen /)).toBeInTheDocument();
    expect(screen.getByText("unreachable · never reached")).toBeInTheDocument();
    expect(screen.getByText("Unknown, unreachable or incompatible · 3")).toBeInTheDocument();
  });

  it("offers Open as a real labelled anchor in a new tab with a 44px target", () => {
    render(<RoomsPanel />);
    const workshop = screen.getByRole("link", { name: "Open Workshop in a new tab" });
    expect(workshop).toHaveAttribute("href", "http://127.0.0.1/workshop");
    expect(workshop).toHaveAttribute("target", "_blank");
    expect(workshop).toHaveAttribute("rel", "noopener noreferrer");
    expect(workshop.className).toContain("min-h-[var(--pw-targets-minimum)]");
  });

  it("collapses quiet rooms when something needs you, with a real toggle", () => {
    render(<RoomsPanel />);
    const toggle = screen.getByRole("button", { name: "1 quiet room, all healthy · Show" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Open VEFR in a new tab" })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Open VEFR in a new tab" })).toBeInTheDocument();
  });

  it("opens the quiet list when nothing needs you", () => {
    setRooms([QUIET]);
    render(<RoomsPanel />);
    expect(screen.getByText("Nothing needs you right now · 1 quiet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /quiet room/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("shows no art outside the Doorways theme, and only initials without the crew", () => {
    const { container } = render(<RoomsPanel />);
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("adds interiors in Doorways and keeper portraits with the crew on — all decorative", () => {
    document.documentElement.setAttribute("data-theme", "doorways");
    document.documentElement.setAttribute("data-pw-personality-pack", "residents");
    setRooms([
      {
        ...WORKSHOP,
        keeper: { id: "bolt", name: "Bolt", portrait_url: "/assets/crew/512/bolt-portrait.webp", initial: "B" },
      },
      PLAYNICE,
    ]);
    const { container } = render(<RoomsPanel />);
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.some((i) => i.getAttribute("src")?.endsWith("assets/crew/512/workshop-doorway.webp"))).toBe(true);
    expect(imgs.some((i) => i.getAttribute("src")?.endsWith("assets/crew/512/bolt-portrait.webp"))).toBe(true);
    for (const img of imgs) expect(img).toHaveAttribute("alt", "");
    expect(screen.getByText(/kept by Bolt/)).toBeInTheDocument();
    // Keepers come from the server, never a built-in map: Play-Nice has none.
    expect(screen.queryByText(/kept by Hekek/)).not.toBeInTheDocument();
  });

  it("shows a doorway chosen on this device over the room's own art, and nothing unchosen", () => {
    document.documentElement.setAttribute("data-theme", "doorways");
    window.localStorage.setItem("pw-room-doorways", JSON.stringify({ "play-nice": "garden", workshop: "not-a-door" }));
    const { container } = render(<RoomsPanel />);
    const srcs = Array.from(container.querySelectorAll("img")).map((i) => i.getAttribute("src") ?? "");
    expect(srcs.some((s) => s.endsWith("assets/crew/512/doorway-garden.webp"))).toBe(true);
    // An unknown choice is ignored: Workshop keeps its own painted room.
    expect(srcs.some((s) => s.endsWith("assets/crew/512/workshop-doorway.webp"))).toBe(true);
    // No room gets a library doorway it wasn't given.
    expect(srcs.filter((s) => s.includes("/doorway-"))).toHaveLength(1);
    window.localStorage.removeItem("pw-room-doorways");
  });

  it("gives a keeper with no picture the crew commbadge and their initial", () => {
    document.documentElement.setAttribute("data-pw-personality-pack", "residents");
    setRooms([{ ...WORKSHOP, keeper: { id: "pip", name: "Pip", portrait_url: null, initial: "P" } }]);
    const { container } = render(<RoomsPanel />);
    const badge = Array.from(container.querySelectorAll("img")).find((i) =>
      i.getAttribute("src")?.endsWith("assets/crew/256/sol-badge.webp"),
    );
    expect(badge).toBeDefined();
    expect(badge!.closest("[aria-hidden='true']")).toHaveTextContent("P");
    expect(screen.getByText(/kept by Pip/)).toBeInTheDocument();
  });

  it("hides keepers when the personality pack is off, even when the server names one", () => {
    setRooms([{ ...WORKSHOP, keeper: { id: "bolt", name: "Bolt", portrait_url: null, initial: "B" } }]);
    render(<RoomsPanel />);
    expect(screen.queryByText(/kept by/)).not.toBeInTheDocument();
  });

  it("stops charging for a need you've marked seen, and says so in words", () => {
    setRooms([{ ...WORKSHOP, needs_seen: ["workshop-need-0"] }, QUIET]);
    render(<RoomsPanel />);
    expect(screen.queryByText("Needs you")).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing needs you right now/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /quiet room/ }));
    expect(screen.getByText(/1 need you've seen/)).toBeInTheDocument();
  });

  it("marks the shown need seen, and records a visit when a room is opened", () => {
    hookState.markSeen.mockClear();
    hookState.visit.mockClear();
    setRooms([WORKSHOP]);
    render(<RoomsPanel />);
    fireEvent.click(
      screen.getByRole("button", { name: "Mark “Review an agent's proposed changes” as seen" }),
    );
    expect(hookState.markSeen).toHaveBeenCalledWith({ roomId: "workshop", needId: "workshop-need-0" });
    fireEvent.click(screen.getByRole("link", { name: "Open Workshop in a new tab" }));
    expect(hookState.visit).toHaveBeenCalledWith({ roomId: "workshop", title: "Workshop" });
  });

  it("says where you left off, and who kept your place when the crew is on", () => {
    const at = "2026-09-25T21:35:22Z";
    hookState.rooms = {
      ...hookState.rooms,
      data: {
        ok: true,
        data: [{ ...QUIET, keeper: { id: "ratatoskr", name: "Ratatoskr", portrait_url: null, initial: "R" } }],
        resume: { room_id: "vefr", title: null, link: null, at },
        summary: { needs_you: 0, changed: 2, can_wait: 0, unknown: 0, unreachable: 0 },
      },
    };
    render(<RoomsPanel />);
    expect(screen.getByText(/You were last in VEFR/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to VEFR in a new tab" })).toBeInTheDocument();
    expect(screen.getByText(/2 new since you last looked/)).toBeInTheDocument();
    cleanup();

    document.documentElement.setAttribute("data-pw-personality-pack", "residents");
    render(<RoomsPanel />);
    expect(screen.getByText(/Ratatoskr kept your place in VEFR/)).toBeInTheDocument();
  });

  it("names loading and failure plainly, inventing nothing", () => {
    setRooms(undefined, { isPending: true });
    render(<RoomsPanel />);
    expect(screen.getByText("Checking your rooms…")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    cleanup();

    const refetch = vi.fn(() => Promise.resolve());
    setRooms(undefined, { isError: true, error: new Error("boom"), refetch });
    render(<RoomsPanel />);
    expect(
      screen.getByText("Couldn't check your rooms right now. Nothing here is invented."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows an honest empty state when no rooms are configured", () => {
    setRooms([]);
    render(<RoomsPanel />);
    expect(
      screen.getByText("No rooms are set up yet. When a room connects, its door appears here."),
    ).toBeInTheDocument();
  });

  it("says when the check is old instead of pretending it's fresh", () => {
    setRooms([{ ...QUIET, checked_at: "2020-01-01T00:00:00Z" }]);
    render(<RoomsPanel />);
    expect(screen.getByText(/^Last checked .*You're seeing what the rooms said then\.$/)).toBeInTheDocument();
  });
});
