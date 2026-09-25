/**
 * Tests for RoomsPanel — the estate's rooms on the Bridge (contract:
 * room/0). The data boundary (useRooms) is mocked; the fixture IS the
 * server vocabulary. The assertions are the honesty floor and the
 * accessibility floor: text-carried status words, unreachable rooms
 * never shown healthy, the Open link a real labelled anchor opening in
 * a new tab, and a 44px target.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const { hookState } = vi.hoisted(() => ({
  hookState: {
    rooms: {
      isPending: false,
      isError: false,
      error: undefined as unknown,
      data: undefined as unknown,
    },
  },
}));

vi.mock("../data/hooks", () => ({
  useRooms: () => hookState.rooms,
}));

import { RoomsPanel } from "../components/RoomsPanel";

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

const HEALTHY = {
  id: "studio",
  base_url: "http://127.0.0.1:8940",
  reachable: true,
  status: "healthy",
  room: descriptor("Studio", "healthy"),
  needs_you: [
    {
      id: "need-1",
      title: "Confirm the transfer",
      why: "A withdrawal above the usual threshold is waiting.",
      actions: ["confirm-transfer"],
      created_at: "2026-09-25T12:30:00Z",
    },
  ],
  error: null,
  checked_at: "2026-09-25T13:10:00Z",
  last_seen: "2026-09-25T13:10:00Z",
};

const DEGRADED_NO_NEEDS = {
  id: "workshop",
  base_url: "https://room.test",
  reachable: true,
  status: "degraded",
  room: descriptor("Workshop", "degraded", "workshop"),
  needs_you: [],
  error: null,
  checked_at: "2026-09-25T13:10:00Z",
  last_seen: "2026-09-25T13:10:00Z",
};

const UNREACHABLE_SEEN = {
  id: "cellar",
  base_url: "http://127.0.0.1:9000",
  reachable: false,
  status: "unreachable",
  room: null,
  needs_you: [],
  error: "connect error",
  checked_at: "2026-09-25T13:10:00Z",
  last_seen: "2026-09-25T12:00:00Z",
};

const UNREACHABLE_NEVER = {
  ...UNREACHABLE_SEEN,
  id: "attic",
  last_seen: null,
};

beforeEach(() => {
  hookState.rooms = {
    isPending: false,
    isError: false,
    error: undefined,
    data: { ok: true, data: [HEALTHY, DEGRADED_NO_NEEDS, UNREACHABLE_SEEN, UNREACHABLE_NEVER] },
  };
});

afterEach(() => cleanup());

describe("RoomsPanel", () => {
  it("shows each room's name, a status WORD, and its needs", () => {
    render(<RoomsPanel />);

    expect(screen.getByRole("region", { name: "Rooms" })).toBeInTheDocument();
    expect(screen.getByText("Studio")).toBeInTheDocument();

    // Status is a word, never color alone (§1.3).
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Degraded")).toBeInTheDocument();
    // Two unreachable rooms — both carry the word as text.
    expect(screen.getAllByText("Unreachable")).toHaveLength(2);

    // The count and the first need's title.
    expect(
      screen.getByText("1 need you · Confirm the transfer"),
    ).toBeInTheDocument();
    expect(screen.getByText("Nothing needs you right now.")).toBeInTheDocument();
  });

  it("renders an unreachable room with last-seen, never as healthy", () => {
    render(<RoomsPanel />);
    // "unreachable · last seen <time>" and "never reached" both appear.
    expect(screen.getByText(/^unreachable · last seen /)).toBeInTheDocument();
    expect(screen.getByText("unreachable · never reached")).toBeInTheDocument();
    // No row claims healthy for an unreachable room.
    expect(screen.queryByText(/^Studio.*Healthy$/)).toBeNull();
  });

  it("offers Open as a real labelled anchor in a new tab with a 44px target", () => {
    render(<RoomsPanel />);
    const opens = screen.getAllByRole("link", { name: /^Open .* in a new tab$/ });
    expect(opens).toHaveLength(4);
    const studio = screen.getByRole("link", {
      name: "Open Studio in a new tab",
    });
    expect(studio).toHaveAttribute("href", "http://127.0.0.1:8940");
    expect(studio).toHaveAttribute("target", "_blank");
    expect(studio).toHaveAttribute("rel", "noopener noreferrer");
    expect(studio.className).toContain("min-h-[var(--pw-targets-minimum)]");
  });

  it("names loading and failure plainly, inventing nothing", () => {
    hookState.rooms = {
      isPending: true,
      isError: false,
      error: undefined,
      data: undefined,
    };
    render(<RoomsPanel />);
    expect(screen.getByText("Checking your rooms…")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    cleanup();

    hookState.rooms = {
      isPending: false,
      isError: true,
      error: new Error("boom"),
      data: undefined,
    };
    render(<RoomsPanel />);
    expect(
      screen.getByText("Couldn't check your rooms right now. Nothing here is invented."),
    ).toBeInTheDocument();
  });

  it("shows an honest empty state when no rooms are configured", () => {
    hookState.rooms = {
      isPending: false,
      isError: false,
      error: undefined,
      data: { ok: true, data: [] },
    };
    render(<RoomsPanel />);
    expect(screen.getByText("No rooms are set up yet.")).toBeInTheDocument();
  });
});