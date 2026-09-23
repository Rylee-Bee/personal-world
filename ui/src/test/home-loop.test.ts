/**
 * Tests for src/screens/Overview/home-loop.ts — the daily home
 * loop's deterministic logic (TRUE-NORTH, Wave 1 Lane A).
 *
 * The honesty floor is the point of every case here: unknown stays
 * unknown, absent stays absent, and the Keeper's pose depends on the
 * clock alone (WORLD_KEEPER.md §7.1 — never telemetry).
 */
import { describe, it, expect } from "vitest";
import type { JournalEvent, ProjectsStatusData } from "../data/contract";
import {
  discoverySliverState,
  greetForHour,
  keeperStateForHour,
  KEEPER_STATES,
  lastThread,
  projectsViewState,
  projectRowView,
  threadWhen,
} from "../screens/Overview/home-loop";

function journalEvent(ts: string, summary: string): JournalEvent {
  return {
    ts,
    kind: "observation",
    summary,
    provenance: {
      source: "user",
      observed_at: ts,
      provider: null,
      authority: "observed",
    },
    classification: "private",
    supersedes: null,
    supersede_reason: null,
  };
}

describe("keeperStateForHour — the greet pose", () => {
  it("is one of the six canonical WORLD_KEEPER states for every hour", () => {
    for (let hour = 0; hour < 24; hour++) {
      expect(KEEPER_STATES).toContain(keeperStateForHour(hour));
    }
  });

  it("sleeps at night and greets the rest of the day", () => {
    expect(keeperStateForHour(0)).toBe("sleep");
    expect(keeperStateForHour(5)).toBe("sleep");
    expect(keeperStateForHour(6)).toBe("hello");
    expect(keeperStateForHour(12)).toBe("hello");
    expect(keeperStateForHour(20)).toBe("hello");
    expect(keeperStateForHour(21)).toBe("sleep");
    expect(keeperStateForHour(23)).toBe("sleep");
  });

  it("depends on the clock alone — same hour, same pose", () => {
    for (let hour = 0; hour < 24; hour++) {
      expect(keeperStateForHour(hour)).toBe(keeperStateForHour(hour));
    }
  });

  it("floors fractional hours deterministically", () => {
    expect(keeperStateForHour(5.9)).toBe("sleep");
    expect(keeperStateForHour(20.9)).toBe("hello");
  });
});

describe("greetForHour — the greet line", () => {
  it("matches the four warm buckets", () => {
    expect(greetForHour(3)).toBe("Good night");
    expect(greetForHour(9)).toBe("Good morning");
    expect(greetForHour(15)).toBe("Good afternoon");
    expect(greetForHour(19)).toBe("Good evening");
    expect(greetForHour(23)).toBe("Good night");
  });
});

describe("lastThread — yesterday's thread", () => {
  it("is null when nothing arrived", () => {
    expect(lastThread(undefined)).toBeNull();
    expect(lastThread({ ok: false, status: "unavailable" })).toBeNull();
    expect(lastThread({ ok: true, data: { entry: null } })).toBeNull();
  });

  it("is the server's own last entry, verbatim", () => {
    const newest = journalEvent("2026-09-21T18:00:00Z", "Latest thread");
    expect(lastThread({ ok: true, data: { entry: newest } })).toBe(newest);
  });
});

describe("threadWhen — the human when-line", () => {
  it("formats a real timestamp locally", () => {
    expect(threadWhen("2026-09-19T16:00:00Z")).toMatch(/Sep 19/);
  });

  it("says unknown for a timestamp it cannot read", () => {
    expect(threadWhen("not-a-date")).toBe("at an unknown time");
  });
});

describe("discoverySliverState — the brought-to-you slot", () => {
  it("is unavailable on error, silence, or a soft failure", () => {
    expect(discoverySliverState(undefined, false)).toEqual({ kind: "unavailable" });
    expect(discoverySliverState(undefined, true)).toEqual({ kind: "unavailable" });
    expect(
      discoverySliverState({ ok: false, status: "unavailable" }, false),
    ).toEqual({ kind: "unavailable" });
  });

  it("names the honest empty state when no source exists", () => {
    expect(
      discoverySliverState(
        { ok: true, data: { source_count: 0, item_count: 0 } },
        false,
      ),
    ).toEqual({ kind: "no-source" });
  });

  it("promises cadence when sources listen but no batch is due", () => {
    expect(
      discoverySliverState(
        { ok: true, data: { source_count: 2, item_count: 0 } },
        false,
      ),
    ).toEqual({ kind: "listening", sources: 2 });
  });

  it("counts a waiting batch truthfully", () => {
    expect(
      discoverySliverState(
        { ok: true, data: { source_count: 1, item_count: 3 } },
        false,
      ),
    ).toEqual({ kind: "waiting", items: 3 });
  });

  it("falls back to row arrays when counts are absent", () => {
    expect(
      discoverySliverState(
        { ok: true, data: { sources: [1, 2], items: [7] } },
        false,
      ),
    ).toEqual({ kind: "waiting", items: 1 });
  });
});

const ROW_WITH_REMOTE = {
  project: "personal-world",
  path: "/srv/projects/personal-world",
  is_git_repo: true,
  branch: "main",
  local_head: "2527c0d",
  remote_name: "origin",
  remote_url: "https://example.invalid/personal-world.git",
  remote_head: "2527c0d",
  publish_state: "match" as const,
  working_tree: { staged: 0, modified: 2, untracked: 0, conflicted: 0 },
  play_nice: { present: true, revision: "1", source_repository: null },
  work_state: "working",
  safe_to_leave: "no" as const,
  error: null,
};

const ROW_WITHOUT_REMOTE = {
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
  safe_to_leave: "unknown" as const,
  error: null,
};

describe("projectRowView — source-to-details words", () => {
  it("links the authoritative remote and speaks plain words", () => {
    const view = projectRowView(ROW_WITH_REMOTE);
    expect(view.sourceUrl).toBe("https://example.invalid/personal-world.git");
    expect(view.publishWords).toBe("in step with its remote");
    expect(view.workWords).toBe("work in progress");
    expect(view.safeWords).toBe("not safe to leave");
    expect(view.openWork).toBe("2 modified");
  });

  it("never invents a source link or a publish state", () => {
    const view = projectRowView(ROW_WITHOUT_REMOTE);
    expect(view.sourceUrl).toBeNull();
    expect(view.publishWords).toBe("publication state unknown");
    expect(view.workWords).toBe("waiting for help");
    expect(view.safeWords).toBe("leave-safety unknown");
    expect(view.openWork).toBe("1 untracked");
  });

  it("says nothing about open work when the tree is clean", () => {
    const view = projectRowView({
      ...ROW_WITH_REMOTE,
      working_tree: { staged: 0, modified: 0, untracked: 0, conflicted: 0 },
    });
    expect(view.openWork).toBeNull();
  });
});

describe("projectsViewState — the parked-Projects section", () => {
  it("is unavailable on error or silence", () => {
    expect(projectsViewState(undefined, true)).toEqual({
      kind: "unavailable",
      warning: null,
    });
    expect(projectsViewState(undefined, false)).toEqual({
      kind: "unavailable",
      warning: null,
    });
  });

  it("carries the sensor's own warning on a soft failure", () => {
    const view = projectsViewState(
      { ok: false, status: "unavailable", warnings: ["agent-sync CLI not found"] },
      false,
    );
    expect(view).toEqual({ kind: "unavailable", warning: "agent-sync CLI not found" });
  });

  it("is an honest empty registry, not an error, when the list is empty", () => {
    const data: ProjectsStatusData = {
      observed_at: "2026-09-22T08:00:00Z",
      freshness: "fresh",
      age_seconds: 10,
      projects: [],
    };
    expect(projectsViewState({ ok: true, data }, false)).toEqual({ kind: "empty" });
  });

  it("maps rows and keeps the observation visibly dated", () => {
    const data: ProjectsStatusData = {
      observed_at: "2026-09-22T08:00:00Z",
      freshness: "stale",
      age_seconds: 7200,
      projects: [ROW_WITH_REMOTE, ROW_WITHOUT_REMOTE],
    };
    const view = projectsViewState({ ok: true, data }, false);
    expect(view.kind).toBe("rows");
    if (view.kind !== "rows") return;
    expect(view.rows).toHaveLength(2);
    expect(view.freshnessWords).toBe("an out-of-date observation");
    expect(view.observedLabel).toMatch(/Sep 22/);
  });

  it("keeps an unknown observation age unknown", () => {
    const data: ProjectsStatusData = {
      observed_at: null,
      freshness: "unknown",
      age_seconds: null,
      projects: [ROW_WITH_REMOTE],
    };
    const view = projectsViewState({ ok: true, data }, false);
    if (view.kind !== "rows") throw new Error("expected rows");
    expect(view.freshnessWords).toBe("an observation of unknown age");
    expect(view.observedLabel).toBeNull();
  });
});
