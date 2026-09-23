/**
 * Tests for the Overview home-loop sections (TRUE-NORTH, Wave 1
 * Lane A): ThreadCard (Resume), DiscoverySliver (Discover) and
 * ProjectsStatus (the parked-Projects ruling).
 *
 * Pattern (same philosophy as settings-room.test.tsx): the data
 * layer is mocked at the hooks boundary; the fixtures ARE the server
 * vocabulary, and the assertions are the honesty floor + the a11y
 * floor (44px targets, text-carried state, no dead doors).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── Mocked data boundary ────────────────────────────────────────────

const { hookState } = vi.hoisted(() => ({
  hookState: {
    journal: { isPending: false, isError: false, data: undefined as unknown },
    discovery: { isPending: false, isError: false, data: undefined as unknown },
    projects: { isPending: false, isError: false, data: undefined as unknown },
  },
}));

vi.mock("../data/hooks", () => ({
  useJournalList: () => hookState.journal,
  useDiscoveryStatus: () => hookState.discovery,
  useProjectsStatus: () => hookState.projects,
}));

import { ThreadCard } from "../screens/Overview/ThreadCard";
import { DiscoverySliver } from "../screens/Overview/DiscoverySliver";
import { ProjectsStatus } from "../screens/Overview/ProjectsStatus";

const THREAD = {
  ts: "2026-09-21T18:00:00Z",
  kind: "observation",
  summary: "Picked the calm-hub direction; the loop comes first.",
  provenance: {
    source: "user",
    observed_at: "2026-09-21T18:00:00Z",
    provider: null,
    authority: "observed",
  },
  classification: "private",
  supersedes: null,
  supersede_reason: null,
};

const PROJECTS_BODY = {
  ok: true,
  status: "healthy",
  data: {
    observed_at: "2026-09-22T08:00:00Z",
    freshness: "fresh",
    age_seconds: 120,
    projects: [
      {
        project: "personal-world",
        path: "/srv/projects/personal-world",
        is_git_repo: true,
        branch: "main",
        local_head: "2527c0d",
        remote_name: "origin",
        remote_url: "https://example.invalid/personal-world.git",
        remote_head: "2527c0d",
        publish_state: "match",
        working_tree: { staged: 0, modified: 2, untracked: 0, conflicted: 0 },
        play_nice: { present: true, revision: "1", source_repository: null },
        work_state: "working",
        safe_to_leave: "no",
        error: null,
      },
      {
        project: "pickle",
        path: "/srv/projects/pickle",
        is_git_repo: true,
        branch: "dev",
        local_head: "abc1234",
        remote_name: null,
        remote_url: null,
        remote_head: null,
        publish_state: null,
        working_tree: { staged: 0, modified: 0, untracked: 1, conflicted: 0 },
        play_nice: { present: false, revision: null, source_repository: null },
        work_state: "waiting_for_help",
        safe_to_leave: "unknown",
        error: null,
      },
    ],
  },
  warnings: [],
};

beforeEach(() => {
  hookState.journal = { isPending: false, isError: false, data: undefined };
  hookState.discovery = { isPending: false, isError: false, data: undefined };
  hookState.projects = { isPending: false, isError: false, data: undefined };
});

afterEach(() => cleanup());

describe("ThreadCard — Resume", () => {
  it("shows the newest thread and one tap into Memory", async () => {
    const onOpenMemory = vi.fn();
    hookState.journal = {
      isPending: false,
      isError: false,
      data: { ok: true, data: [THREAD] },
    };
    render(<ThreadCard onOpenMemory={onOpenMemory} />);

    expect(
      screen.getByText("Picked the calm-hub direction; the loop comes first."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Observation · Sep 21/)).toBeInTheDocument();

    const button = screen.getByRole("button", {
      name: "Pick up in Memory",
    });
    await userEvent.click(button);
    expect(onOpenMemory).toHaveBeenCalledTimes(1);
  });

  it("meets the 44px target floor on its door", () => {
    hookState.journal = {
      isPending: false,
      isError: false,
      data: { ok: true, data: [THREAD] },
    };
    const { container } = render(<ThreadCard onOpenMemory={() => {}} />);
    const button = container.querySelector("button");
    expect(button?.className).toContain("min-h-[var(--pw-targets-minimum)]");
  });

  it("renders a warm, true empty line for an empty journal", () => {
    hookState.journal = {
      isPending: false,
      isError: false,
      data: { ok: true, data: [] },
    };
    render(<ThreadCard onOpenMemory={() => {}} />);
    expect(screen.getByText(/Nothing written yet/)).toBeInTheDocument();
    expect(screen.queryByText(/unreachable/i)).toBeNull();
  });

  it("says unreachable plainly when the journal cannot be read", () => {
    hookState.journal = {
      isPending: false,
      isError: true,
      data: undefined,
    };
    render(<ThreadCard onOpenMemory={() => {}} />);
    expect(
      screen.getByText(/Your journal is unreachable right now/),
    ).toBeInTheDocument();
  });

  it("renders nothing while pending — no shimmer, no lie", () => {
    hookState.journal = { isPending: true, isError: false, data: undefined };
    const { container } = render(<ThreadCard onOpenMemory={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("DiscoverySliver — Discover", () => {
  it("ships the honest empty state when no source exists", async () => {
    const onOpenArea = vi.fn();
    hookState.discovery = {
      isPending: false,
      isError: false,
      data: {
        ok: true,
        status: "healthy",
        data: { sources: [], interests: [], items: [], source_count: 0, interest_count: 0, item_count: 0 },
        warnings: [],
      },
    };
    render(<DiscoverySliver onOpenArea={onOpenArea} />);
    expect(screen.getByText(/No source yet/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Open Interests" }));
    expect(onOpenArea).toHaveBeenCalledWith("interests");
  });

  it("promises cadence, not a firehose, while sources listen", () => {
    hookState.discovery = {
      isPending: false,
      isError: false,
      data: {
        ok: true,
        status: "healthy",
        data: { source_count: 2, item_count: 0 },
        warnings: [],
      },
    };
    render(<DiscoverySliver onOpenArea={() => {}} />);
    expect(screen.getByText(/2 sources are/)).toBeInTheDocument();
    expect(screen.getByText(/own\s*cadence|cadence/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("counts a waiting batch and opens Interests", () => {
    hookState.discovery = {
      isPending: false,
      isError: false,
      data: {
        ok: true,
        status: "healthy",
        data: { source_count: 1, item_count: 2 },
        warnings: [],
      },
    };
    render(<DiscoverySliver onOpenArea={() => {}} />);
    expect(screen.getByText(/2 small picks are/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "See them in Interests" }),
    ).toBeInTheDocument();
  });

  it("says unavailable plainly when discovery cannot be read", () => {
    hookState.discovery = { isPending: false, isError: true, data: undefined };
    render(<DiscoverySliver onOpenArea={() => {}} />);
    expect(
      screen.getByText(/Discovery is unavailable right now/),
    ).toBeInTheDocument();
  });
});

describe("ProjectsStatus — deterministic source to details", () => {
  it("renders rows that link to their authoritative source", () => {
    hookState.projects = {
      isPending: false,
      isError: false,
      data: PROJECTS_BODY,
    };
    const { container } = render(<ProjectsStatus />);
    const section = screen.getByRole("region", { name: "Projects" });

    expect(within(section).getByText(/personal-world/)).toBeInTheDocument();
    const link = screen.getByRole("link", {
      name: "Open the source of personal-world",
    });
    expect(link.getAttribute("href")).toBe(
      "https://example.invalid/personal-world.git",
    );
    expect(link.getAttribute("rel")).toContain("noreferrer");

    // The row without a remote links nowhere and says so — never a
    // guessed URL.
    expect(within(section).getByText("no remote recorded")).toBeInTheDocument();
    expect(within(section).getByText(/in step with its remote/)).toBeInTheDocument();
    expect(within(section).getByText(/waiting for help/)).toBeInTheDocument();
    // The observation stays visibly dated.
    expect(within(section).getByText(/a fresh observation/)).toBeInTheDocument();
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("says no source yet, with the row shape promised, when agent-sync is absent", () => {
    hookState.projects = {
      isPending: false,
      isError: false,
      data: {
        ok: false,
        status: "unavailable",
        data: null,
        warnings: ["agent-sync CLI not found on this host"],
      },
    };
    render(<ProjectsStatus />);
    const section = screen.getByRole("region", { name: "Projects" });
    expect(
      within(section).getByText(/No project source yet/),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(/agent-sync CLI not found on this host/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("treats an empty registry as honest, not broken", () => {
    hookState.projects = {
      isPending: false,
      isError: false,
      data: {
        ok: true,
        status: "healthy",
        data: { observed_at: null, freshness: "unknown", age_seconds: null, projects: [] },
        warnings: [],
      },
    };
    render(<ProjectsStatus />);
    expect(
      screen.getByText(/empty registry/),
    ).toBeInTheDocument();
  });

  it("says unavailable plainly on a hard query error", () => {
    hookState.projects = { isPending: false, isError: true, data: undefined };
    render(<ProjectsStatus />);
    expect(screen.getByText(/No project source yet/)).toBeInTheDocument();
  });
});
