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
    secrets: {
      isPending: false,
      isError: false,
      error: undefined as unknown,
      data: undefined as unknown,
    },
  },
}));

vi.mock("../data/hooks", () => ({
  useRooms: () => hookState.rooms,
  useVisitRoom: () => ({ mutate: hookState.visit }),
  useSecretsOverview: () => hookState.secrets,
  useMarkNeedSeen: () => ({
    mutate: hookState.markSeen,
    isPending: false,
    isError: false,
  }),
}));

import { RoomsPanel } from "../components/RoomsPanel";
import { groupRooms, MAX_DOORWAYS } from "../components/rooms/groupRooms";
import type { RoomRow } from "../data/contract";
import { ApiError } from "../data/api";

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

  it("shows the doorway the person chose over the room's own art, and nothing unchosen", () => {
    document.documentElement.setAttribute("data-theme", "doorways");
    setRooms([
      WORKSHOP,
      { ...PLAYNICE, doorway: "garden" },
      { ...QUIET, doorway: "not-a-door" },
    ]);
    const { container } = render(<RoomsPanel />);
    fireEvent.click(screen.getByRole("button", { name: /quiet room/ }));
    const srcs = Array.from(container.querySelectorAll("img")).map((i) => i.getAttribute("src") ?? "");
    expect(srcs.some((s) => s.endsWith("assets/crew/512/doorway-garden.webp"))).toBe(true);
    expect(srcs.some((s) => s.endsWith("assets/crew/512/workshop-doorway.webp"))).toBe(true);
    // An id outside the library is ignored: VEFR keeps its own painted room.
    expect(srcs.some((s) => s.endsWith("assets/crew/512/vefr-doorway.webp"))).toBe(true);
    expect(srcs.filter((s) => s.includes("/doorway-"))).toHaveLength(1);
  });

  it("never counts an incompatible room's needs, and says why in words", () => {
    setRooms([
      room("odd", "Odd room", "incompatible", [{ title: "Should not count" }], { error: "unsupported contract room/9" }),
    ]);
    render(<RoomsPanel />);
    expect(screen.queryByText("Needs you")).not.toBeInTheDocument();
    expect(screen.getByText(/not compatible with this front door · unsupported contract room\/9/)).toBeInTheDocument();
  });

  it("says when the room list couldn't be refreshed, and is quiet when it could", () => {
    hookState.rooms = {
      ...hookState.rooms,
      data: {
        ok: true,
        data: [QUIET],
        registry: { source: "last_known_good", status: "unreachable", checked_at: NOW, updated_at: NOW, dropped: 2 },
      },
    };
    render(<RoomsPanel />);
    expect(screen.getByText(/Couldn't refresh the room list/)).toBeInTheDocument();
    expect(screen.getByText(/2 entries in the room list couldn't be read/)).toBeInTheDocument();
    cleanup();
    hookState.rooms = {
      ...hookState.rooms,
      data: { ok: true, data: [QUIET], registry: { source: "registry", status: "ok", checked_at: NOW, dropped: 0 } },
    };
    render(<RoomsPanel />);
    expect(screen.queryByText(/room list/)).not.toBeInTheDocument();
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

  it("reviews a need on the room's own site, and remembers the exact item", () => {
    hookState.visit.mockClear();
    setRooms([
      {
        ...WORKSHOP,
        base_url: "https://workshop.test/app",
        needs_you: [
          {
            id: "n1",
            title: "Approve the plan",
            why: "It's ready.",
            actions: [],
            created_at: "2026-09-25T09:00:00Z",
            link: "/workshop?tab=tasks&task=7",
          },
        ],
      },
    ]);
    render(<RoomsPanel />);
    // A room's link is a path on the ROOM's site, never a Worlds path.
    const review = screen.getByRole("link", { name: "Review “Approve the plan” in a new tab" });
    expect(review).toHaveAttribute("href", "https://workshop.test/workshop?tab=tasks&task=7");
    // The room's front door stays one click away.
    expect(screen.getByRole("link", { name: "Open Workshop in a new tab" })).toHaveAttribute(
      "href",
      "https://workshop.test/app",
    );
    fireEvent.click(review);
    expect(hookState.visit).toHaveBeenCalledWith({
      roomId: "workshop",
      title: "Approve the plan",
      link: "/workshop?tab=tasks&task=7",
    });
  });

  it("goes back to the exact item you left, when the room gave one", () => {
    hookState.rooms = {
      ...hookState.rooms,
      data: {
        ok: true,
        data: [{ ...QUIET, base_url: "https://vefr.test" }],
        resume: { room_id: "vefr", title: "Flight log", link: "/log/3", at: "2026-09-25T21:35:22Z" },
        summary: { needs_you: 0, changed: 0, can_wait: 0, unknown: 0, unreachable: 0 },
      },
    };
    render(<RoomsPanel />);
    expect(screen.getByRole("link", { name: "Back to VEFR in a new tab" })).toHaveAttribute(
      "href",
      "https://vefr.test/log/3",
    );
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
      screen.getByText("No rooms yet"),
    ).toBeInTheDocument();
  });

  it("says when the check is old instead of pretending it's fresh", () => {
    setRooms([{ ...QUIET, checked_at: "2020-01-01T00:00:00Z" }]);
    render(<RoomsPanel />);
    expect(screen.getByText(/^Last checked .*You're seeing what the rooms said then\.$/)).toBeInTheDocument();
  });
});

// ─── The room drawer (Spec-Drawer) ──────────────────────────────────

describe("RoomDrawer", () => {
  const card = (id: string, title: string, observed: string, extra: Record<string, unknown> = {}) => ({
    id,
    title,
    body: `About ${title}.`,
    link: `/items/${id}`,
    lane: "personal",
    freshness: { observed_at: observed, stale_after_s: 10 * 365 * 24 * 3600 },
    ...extra,
  });

  it("opens from Look inside as a labelled dialog, focuses its heading, and returns focus on close", () => {
    setRooms([WORKSHOP]);
    render(<RoomsPanel />);
    const opener = screen.getByRole("button", { name: "Look inside Workshop" });
    expect(opener).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(opener);
    const drawer = screen.getByRole("dialog", { name: "Workshop" });
    expect(within(drawer).getByRole("heading", { level: 2, name: "Workshop" })).toHaveFocus();
    expect(opener).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(within(drawer).getByRole("button", { name: "Close Workshop details" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("closes on Escape", () => {
    setRooms([WORKSHOP]);
    render(<RoomsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Look inside Workshop" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lists what needs you, with the room's safe link and Mark as seen", () => {
    hookState.markSeen.mockClear();
    setRooms([
      {
        ...WORKSHOP,
        base_url: "https://workshop.test/app",
        needs_you: [
          { id: "n1", title: "Approve the plan", why: "It's ready.", actions: [], created_at: "2026-09-25T09:00:00Z", link: "/plans/1" },
          { id: "n2", title: "Evil link", why: "", actions: [], created_at: "2026-09-25T09:00:00Z", link: "//evil.test/x" },
        ],
      },
    ]);
    render(<RoomsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Look inside Workshop" }));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByRole("link", { name: "Review “Approve the plan” in a new tab" })).toHaveAttribute(
      "href",
      "https://workshop.test/plans/1",
    );
    // A link that isn't a same-origin path is refused, never followed.
    expect(within(drawer).queryByRole("link", { name: /Evil link/ })).not.toBeInTheDocument();
    fireEvent.click(within(drawer).getByRole("button", { name: "Mark “Approve the plan” as seen" }));
    expect(hookState.markSeen).toHaveBeenCalledWith({ roomId: "workshop", needId: "n1" });
  });

  it("splits what changed since your last visit from everything else, with tone in words", () => {
    setRooms([
      {
        ...QUIET,
        last_visited_at: "2026-09-25T10:00:00Z",
        cards: [
          card("a", "Checks passed", "2026-09-25T11:00:00Z", { tone: "good_news" }),
          card("b", "Old note", "2026-09-25T08:00:00Z", { tone: "something-new" }),
          card("c", "Later please", "2026-09-25T09:00:00Z", { tone: "when_ready" }),
        ],
      },
    ]);
    render(<RoomsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Look inside VEFR" }));
    const drawer = screen.getByRole("dialog");
    const changed = within(drawer).getByRole("region", { name: "Changed since you last looked · 1" });
    expect(within(changed).getByText("Checks passed")).toBeInTheDocument();
    expect(within(changed).getByText("Good news")).toBeInTheDocument();
    const rest = within(drawer).getByRole("region", { name: "Everything else · 2" });
    // An unknown tone reads as "A small update" (room/0), never dropped.
    expect(within(rest).getByText("A small update")).toBeInTheDocument();
    expect(within(rest).getByText("When you’re ready")).toBeInTheDocument();
  });

  it("says when a card may be out of date", () => {
    setRooms([
      { ...QUIET, cards: [card("s", "Stale thing", "2020-01-01T00:00:00Z", { freshness: { observed_at: "2020-01-01T00:00:00Z", stale_after_s: 60 } })] },
    ]);
    render(<RoomsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Look inside VEFR" }));
    expect(within(screen.getByRole("dialog")).getByText(/may be out of date/)).toBeInTheDocument();
  });

  it("shows nothing as current for an unreachable room, and says why", () => {
    setRooms([{ ...UNREACHABLE_SEEN, cards: [card("x", "Should not show", "2026-09-25T11:00:00Z")] }]);
    render(<RoomsPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Look inside / }));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText(/can’t reach .* right now/)).toBeInTheDocument();
    expect(within(drawer).queryByText("Should not show")).not.toBeInTheDocument();
  });

  it("prefers the room's public address for every link a person follows", () => {
    setRooms([
      {
        ...WORKSHOP,
        base_url: "http://workshop.internal:8940",
        public_url: "https://workshop.example.test",
        needs_you: [
          { id: "n1", title: "Approve the plan", why: "", actions: [], created_at: "2026-09-25T09:00:00Z", link: "/plans/1" },
        ],
      },
    ]);
    render(<RoomsPanel />);
    expect(screen.getByRole("link", { name: "Open Workshop in a new tab" })).toHaveAttribute(
      "href",
      "https://workshop.example.test",
    );
    expect(screen.getByRole("link", { name: "Review “Approve the plan” in a new tab" })).toHaveAttribute(
      "href",
      "https://workshop.example.test/plans/1",
    );
  });

  describe("Secrets in the Workshop's drawer", () => {
    const OVERVIEW = {
      station: { configured: true, status: "ok", detail: null },
      namespaces: [
        { name: "rooms", keys: ["rooms/workshop-token", "rooms/studio-token"] },
        { name: "mail", keys: ["mail/relay-password"] },
      ],
      key_count: 3,
      bundle_last_change: "2026-09-25T22:52:00Z",
      requests: [
        {
          id: "req-1",
          key_path: "mail/relay-password",
          reason: "The digest can't send.",
          requested_at: "2026-09-25T22:40:00Z",
          link: "/secrets?request=req-1",
        },
      ],
      recent_ops: [
        { key_path: "rooms/workshop-token", state: "pushed", deploy_state: "verified", actor: "owner", created_at: "2026-09-25T09:12:00Z" },
        { key_path: "rooms/studio-token", state: "pushed", deploy_state: "pending", actor: "owner", created_at: "2026-09-25T09:13:00Z" },
        { key_path: "mail/relay-password", state: "failed", deploy_state: "unknown", actor: "owner", created_at: "2026-09-25T09:14:00Z" },
        { key_path: "mail/other", state: "unchanged", deploy_state: "unknown", actor: "owner", created_at: "2026-09-25T09:15:00Z" },
        { key_path: "mail/odd", state: "mystery", deploy_state: "unknown", actor: "owner", created_at: "2026-09-25T09:16:00Z" },
      ],
      room_id: "workshop",
      open_url: "https://workshop.example.test/secrets",
    };

    function openWorkshop(secrets: Partial<typeof hookState.secrets>) {
      hookState.secrets = { isPending: false, isError: false, error: undefined, data: undefined, ...secrets };
      setRooms([QUIET, { ...WORKSHOP, needs_you: [] }]);
      render(<RoomsPanel />);
      fireEvent.click(screen.getByRole("button", { name: "Look inside Workshop" }));
      return screen.getByRole("dialog");
    }

    it("shows names, health in words, requests and changes, and never a value field", () => {
      const drawer = openWorkshop({ data: { ok: true, data: OVERVIEW } });
      expect(within(drawer).getByRole("heading", { name: "Secrets" })).toBeInTheDocument();
      expect(within(drawer).getByText("The station is answering")).toBeInTheDocument();
      expect(within(drawer).getByText(/3 keys in 2 groups/)).toBeInTheDocument();
      expect(within(drawer).getByRole("link", { name: "Enter mail/relay-password in Project Home, in a new tab" })).toHaveAttribute(
        "href",
        "https://workshop.example.test/secrets?request=req-1",
      );
      // Groups start closed; opening one shows its names.
      const rooms = within(drawer).getByRole("button", { name: /rooms/ });
      expect(rooms).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(rooms);
      expect(rooms).toHaveAttribute("aria-expanded", "true");
      expect(within(drawer).getAllByText("rooms/workshop-token").length).toBeGreaterThan(0);
      expect(within(drawer).getByText(/reached the station/)).toBeInTheDocument();
      expect(within(drawer).getByText(/waiting for the station/)).toBeInTheDocument();
      expect(within(drawer).getByText(/didn’t save · old value kept/)).toBeInTheDocument();
      expect(within(drawer).getByText(/already set, nothing changed/)).toBeInTheDocument();
      // An unrecognised value is the station's own word, never success.
      expect(within(drawer).getByText(/station says “mystery”/)).toBeInTheDocument();
      // Worlds never has a place to type a value.
      expect(within(drawer).queryByRole("textbox")).toBeNull();
      expect(drawer.querySelector("input[type=password]")).toBeNull();
    });

    it("rests only this section when the station is down", () => {
      const drawer = openWorkshop({
        data: { ok: true, data: { ...OVERVIEW, station: { configured: true, status: "unreachable", detail: null }, requests: [] } },
      });
      expect(within(drawer).getByText(/Secrets are resting: the station isn’t reachable/)).toBeInTheDocument();
      expect(within(drawer).getByRole("heading", { name: /What Workshop is showing/ })).toBeInTheDocument();
    });

    it("isn't there at all for someone who isn't the owner", () => {
      const drawer = openWorkshop({ isError: true, error: new ApiError(403, "admin only") });
      expect(within(drawer).queryByRole("heading", { name: "Secrets" })).toBeNull();
    });

    it("isn't in any other room's drawer", () => {
      hookState.secrets = { isPending: false, isError: false, error: undefined, data: { ok: true, data: OVERVIEW } };
      setRooms([QUIET]);
      render(<RoomsPanel />);
      fireEvent.click(screen.getByRole("button", { name: "Look inside VEFR" }));
      expect(within(screen.getByRole("dialog")).queryByRole("heading", { name: "Secrets" })).toBeNull();
    });
  });
});
