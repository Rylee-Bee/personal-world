import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { CompanionProvider } from "../lib/companion-context";
import { LiveRegionProvider } from "../primitives/LiveRegion";
import ProjectsScreen from "../screens/ProjectsScreen";
import type { SourceControlRepo, AgentSyncProject } from "../lib/api";

/**
 * ProjectsScreen tests aligned to the current implementation:
 * - companion status ("Watching your projects" / "No repositories found");
 * - repo cards with branch, revision, dirty, ahead, behind;
 * - Disclosure-based "History & details" with commit list (revision,
 *   subject, author);
 * - GitHub enrichment inside the disclosure (Open PRs / issues / branch);
 * - agent-sync project estate as a Disclosure, using the shared
 *   vocabulary (lib/project-status.ts + lib/observation-age.ts):
 *   category-labelled StatusChip, per-project sentence, dated age line,
 *   technical guts behind a nested disclosure;
 * - not_configured and unavailable degrade honestly;
 * - axe 0 (contrast off in jsdom).
 */

const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

function repo(overrides: Partial<SourceControlRepo> = {}): SourceControlRepo {
  return {
    name: "personal-world",
    path: "/data/repos/personal-world",
    branch: "main",
    revision: "abc123def456",
    dirty: false,
    ahead: 0,
    behind: 0,
    remote: "https://github.com/example/personal-world.git",
    last_commit_date: "2026-09-12T00:00:00+00:00",
    last_commit_subject: "feat: one small thing",
    error: null,
    ...overrides,
  };
}

function statusEnvelope(repos: SourceControlRepo[]) {
  return new Response(
    JSON.stringify({ ok: true, status: "healthy", data: { repos } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function notConfiguredEnvelope() {
  return new Response(
    JSON.stringify({
      ok: false,
      status: "not_configured",
      warnings: ["no source_control search paths configured"],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function historyEnvelope(repo: string) {
  return new Response(
    JSON.stringify({
      ok: true,
      status: "healthy",
      data: {
        repo,
        commits: [
          {
            revision: "deadbeef",
            date: "2026-09-11T10:00:00+00:00",
            author: "Rylee",
            subject: "fix: the thing",
          },
          {
            revision: "cafebabe",
            date: "2026-09-10T09:00:00+00:00",
            author: "GLM",
            subject: "feat: earlier thing",
          },
        ],
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

let fetchMock: ReturnType<typeof vi.fn>;
let historyCalls: string[] = [];

/** One agent-sync project record (mirrors the sensor's normalized
 *  model) with per-test overrides. */
function estateProject(overrides: Partial<AgentSyncProject> = {}): AgentSyncProject {
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

function estateEnvelope(
  projects: AgentSyncProject[],
  observed_at: string | null = "2026-09-12T12:48:38Z",
  ok = true,
  status = "healthy"
) {
  return new Response(
    JSON.stringify({ ok, status, warnings: [], data: { observed_at, projects } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function stubProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <CompanionProvider>
        <LiveRegionProvider>{ui}</LiveRegionProvider>
      </CompanionProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  historyCalls = [];
  fetchMock = vi.fn().mockImplementation((input: unknown) => {
    const path = typeof input === "string" ? input : String(input);
    if (path.includes("/api/source-control/history")) {
      historyCalls.push(path);
      const repo = new URL(path, "http://x").searchParams.get("repo") ?? "";
      return Promise.resolve(historyEnvelope(repo));
    }
    if (path.includes("/api/source-control/status")) {
      return Promise.resolve(statusEnvelope([repo()]));
    }
    return Promise.resolve(
      new Response(JSON.stringify({ ok: true, data: null }), {
        headers: { "Content-Type": "application/json" },
      })
    );
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProjectsScreen (workspace v1)", () => {
  it("renders one row per configured repo with real fields", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/source-control/status")) {
        return Promise.resolve(
          statusEnvelope([
            repo(),
            repo({ name: "other", branch: "dev", dirty: true, ahead: 2, behind: 1, last_commit_subject: "second repo commit" }),
          ])
        );
      }
      return Promise.resolve(notConfiguredEnvelope());
    });
    const { container } = stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(screen.getByText("Watching your projects")).toBeTruthy()
    );
    expect(screen.getByText("personal-world")).toBeTruthy();
    expect(screen.getByText("other")).toBeTruthy();
    expect(screen.getAllByText("Healthy").length).toBeGreaterThanOrEqual(2);
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("glance line stays quiet when everything is clean", async () => {
    stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(screen.getByText("Watching your projects")).toBeTruthy()
    );
  });

  it("selecting a repo loads its recent commits", async () => {
    stubProviders(<ProjectsScreen />);
    await waitFor(() => expect(screen.getByText("personal-world")).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByText("History & details"));
    });
    await waitFor(() =>
      expect(screen.getByText(/fix: the thing/)).toBeTruthy()
    );
    expect(screen.getByText(/feat: earlier thing/)).toBeTruthy();
    expect(screen.getByText("deadbee")).toBeTruthy();
    expect(screen.getByText("cafebab")).toBeTruthy();
    expect(historyCalls.length).toBe(1);
  });

  it("an error repo keeps its row and renders the path", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/source-control/status")) {
        return Promise.resolve(
          statusEnvelope([repo({ name: "broken", error: "not a git repository", branch: null, revision: null })])
        );
      }
      return Promise.resolve(notConfiguredEnvelope());
    });
    stubProviders(<ProjectsScreen />);
    await waitFor(() => expect(screen.getByText("broken")).toBeTruthy());
  });

  it("not_configured shows the honest empty state naming the knob", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/source-control")) {
        return Promise.resolve(notConfiguredEnvelope());
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: null }), {
          headers: { "Content-Type": "application/json" },
        })
      );
    });
    const { container } = stubProviders(<ProjectsScreen />);
    expect(
      await screen.findByText("No repositories found")
    ).toBeTruthy();
    expect(screen.getByText("no source_control search paths configured")).toBeTruthy();
    expect(screen.getByText("Watching your projects")).toBeTruthy();
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });
});

describe("Projects repository detail (disclosure expansion, commit history)", () => {
  it("expanding a repo disclosure shows the history section", async () => {
    stubProviders(<ProjectsScreen />);
    await waitFor(() => expect(screen.getByText("personal-world")).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByText("History & details"));
    });
    await waitFor(() =>
      expect(screen.getByText("Recent commits")).toBeTruthy()
    );
  });

  it("commit history renders sha, subject, and author", async () => {
    stubProviders(<ProjectsScreen />);
    await waitFor(() => expect(screen.getByText("personal-world")).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByText("History & details"));
    });
    await waitFor(() =>
      expect(screen.getByText(/fix: the thing/)).toBeTruthy()
    );
    expect(screen.getByText(/feat: earlier thing/)).toBeTruthy();
    expect(screen.getByText("deadbee")).toBeTruthy();
    expect(screen.getByText("cafebab")).toBeTruthy();
  });

  it("disclosure starts collapsed, content is hidden by default", async () => {
    stubProviders(<ProjectsScreen />);
    await waitFor(() => expect(screen.getByText("personal-world")).toBeTruthy());
    expect(screen.queryByText("Recent commits")).toBeNull();
  });

  it("multiple repos have independent disclosure state", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/source-control/status")) {
        return Promise.resolve(
          statusEnvelope([
            repo({ name: "first" }),
            repo({ name: "second", branch: "dev" }),
          ])
        );
      }
      if (path.includes("/api/source-control/history")) {
        historyCalls.push(path);
        return Promise.resolve(historyEnvelope(""));
      }
      return Promise.resolve(notConfiguredEnvelope());
    });
    stubProviders(<ProjectsScreen />);
    await waitFor(() => expect(screen.getByText("first")).toBeTruthy());
    expect(screen.getByText("second")).toBeTruthy();
    const disclosures = screen.getAllByText("History & details");
    expect(disclosures.length).toBe(2);
    await act(async () => {
      fireEvent.click(disclosures[0]);
    });
    await waitFor(() =>
      expect(screen.getByText("Recent commits")).toBeTruthy()
    );
  });
});

describe("Projects GitHub enrichment (optional remote facts, quiet degradation)", () => {
  function enrichmentResponse(payload: unknown) {
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const healthyPayload = {
    ok: true,
    status: "healthy",
    data: {
      slug: "example/personal-world",
      url: "https://github.com/example/personal-world",
      default_branch: "main",
      open_prs: 2,
      open_issues: 3,
      pushed_at: "2026-09-12T10:00:00Z",
    },
  };

  async function openDetail() {
    stubProviders(<ProjectsScreen />);
    await waitFor(() => expect(screen.getByText("personal-world")).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByText("History & details"));
    });
  }

  it("shows remote facts with per-field labels when GitHub is healthy", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/source-control/enrichment")) {
        return Promise.resolve(enrichmentResponse(healthyPayload));
      }
      if (path.includes("/api/source-control/history")) {
        historyCalls.push(path);
        return Promise.resolve(historyEnvelope(""));
      }
      if (path.includes("/api/source-control/status")) {
        return Promise.resolve(statusEnvelope([repo()]));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: null }), {
          headers: { "Content-Type": "application/json" },
        })
      );
    });
    await openDetail();
    await waitFor(() =>
      expect(screen.getByText("Remote enrichment")).toBeTruthy()
    );
    expect(screen.getByText("Open PRs: 2")).toBeTruthy();
    expect(screen.getByText("Open issues: 3")).toBeTruthy();
    expect(screen.getByText("Default branch: main")).toBeTruthy();
  });

  it("degrades quietly when gh is missing (unavailable)", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/source-control/enrichment")) {
        return Promise.resolve(
          enrichmentResponse({
            ok: false,
            status: "unavailable",
            warnings: ["gh CLI not found on this host"],
          })
        );
      }
      if (path.includes("/api/source-control/history")) {
        historyCalls.push(path);
        return Promise.resolve(historyEnvelope(""));
      }
      if (path.includes("/api/source-control/status")) {
        return Promise.resolve(statusEnvelope([repo()]));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: null }), {
          headers: { "Content-Type": "application/json" },
        })
      );
    });
    await openDetail();
    await waitFor(() =>
      expect(screen.getByText("Recent commits")).toBeTruthy()
    );
    expect(screen.queryByText("Remote enrichment")).toBeNull();
    expect(screen.getByText("personal-world")).toBeTruthy();
  });

  it("non-GitHub remote shows no enrichment section", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/source-control/enrichment")) {
        return Promise.resolve(
          enrichmentResponse({
            ok: false,
            status: "not_github",
            data: { remote: "https://gitlab.com/example/personal-world.git" },
          })
        );
      }
      if (path.includes("/api/source-control/history")) {
        historyCalls.push(path);
        return Promise.resolve(historyEnvelope(""));
      }
      if (path.includes("/api/source-control/status")) {
        return Promise.resolve(statusEnvelope([repo({ remote: "https://gitlab.com/example/personal-world.git" })]));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: null }), {
          headers: { "Content-Type": "application/json" },
        })
      );
    });
    await openDetail();
    await waitFor(() =>
      expect(screen.getByText("Recent commits")).toBeTruthy()
    );
    expect(screen.queryByText("Remote enrichment")).toBeNull();
  });
});

describe("ProjectsScreen (agent-sync project status panel)", () => {
  /** Route both endpoints: native table keeps answering, estate panel
   *  renders from /api/projects/status. */
  function stubBoth(
    projects: AgentSyncProject[],
    _observedAt: string | null = "2026-09-12T12:48:38Z",
  ) {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/projects/status")) {
        return Promise.resolve(estateEnvelope(projects, _observedAt));
      }
      if (path.includes("/api/source-control/history")) {
        return Promise.resolve(historyEnvelope(""));
      }
      if (path.includes("/api/source-control/status")) {
        return Promise.resolve(statusEnvelope([repo()]));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: null }), {
          headers: { "Content-Type": "application/json" },
        })
      );
    });
  }

  /** The visible estate list row for a project name (the name also
   *  appears in the technical guts, so scope to the sentence list). */
  function estateRow(name: string): HTMLElement {
    const strong = screen
      .getAllByText(name)
      .find((el) => el.closest("li[data-pw-projects-status-item]"));
    return strong!.closest("li") as HTMLElement;
  }

  it("renders every project with the shared estate vocabulary", async () => {
    stubBoth([estateProject(), estateProject({ project: "second" })]);
    stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(screen.getAllByText("demo").length).toBeGreaterThanOrEqual(1)
    );
    expect(screen.getAllByText("second").length).toBeGreaterThanOrEqual(1);
    // Both quiet (clean, publish match): one calm settled line, no alarm.
    expect(screen.getByText("All 2 projects are settled.")).toBeTruthy();
  });

  it("each project renders a category-labelled status chip", async () => {
    stubBoth([estateProject()]);
    stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(screen.getAllByText("demo").length).toBeGreaterThanOrEqual(1)
    );
    const row = estateRow("demo");
    expect(row.querySelector("[data-status]")?.getAttribute("data-status")).toBe(
      "healthy"
    );
    expect(row.textContent).toContain("quiet");
  });

  it("a diverged project is needs_attention with its human sentence", async () => {
    stubBoth([
      estateProject({ project: "split", publish_state: "diverged", safe_to_leave: "no" }),
    ]);
    stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(screen.getAllByText("split").length).toBeGreaterThanOrEqual(1)
    );
    const row = estateRow("split");
    expect(row.getAttribute("data-pw-projects-status-item")).toBe("diverged");
    expect(row.querySelector("[data-status]")?.getAttribute("data-status")).toBe(
      "needs_attention"
    );
    expect(row.textContent).toMatch(/histories have diverged/);
    expect(screen.getByText("1 needs attention")).toBeTruthy();
  });

  it("an unpublished project is needs_attention, not collapsed to warning", async () => {
    stubBoth([estateProject({ project: "aheadproj", publish_state: "ahead" })]);
    stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(screen.getAllByText("aheadproj").length).toBeGreaterThanOrEqual(1)
    );
    const row = estateRow("aheadproj");
    expect(row.getAttribute("data-pw-projects-status-item")).toBe("unpublished");
    expect(row.querySelector("[data-status]")?.getAttribute("data-status")).toBe(
      "needs_attention"
    );
    expect(row.textContent).toMatch(/not published yet/);
  });

  it("local work stays calm — ordinary development is not alarm", async () => {
    stubBoth([
      estateProject({
        project: "wip",
        publish_state: "match",
        working_tree: { staged: 1, modified: 2, untracked: 0, conflicted: 0 },
      }),
    ]);
    stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(screen.getAllByText("wip").length).toBeGreaterThanOrEqual(1)
    );
    const row = estateRow("wip");
    expect(row.getAttribute("data-pw-projects-status-item")).toBe("local_work");
    expect(row.querySelector("[data-status]")?.getAttribute("data-status")).toBe(
      "healthy"
    );
    expect(row.textContent).toMatch(/local work is still in progress/);
    expect(screen.getByText(/1 has local work in progress/)).toBeTruthy();
  });

  it("an unknown remote is honest, never fabricated", async () => {
    stubBoth([estateProject({ project: "unreachable", publish_state: null })]);
    stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(screen.getAllByText("unreachable").length).toBeGreaterThanOrEqual(1)
    );
    const row = estateRow("unreachable");
    expect(row.getAttribute("data-pw-projects-status-item")).toBe("unknown");
    expect(row.querySelector("[data-status]")?.getAttribute("data-status")).toBe(
      "unknown"
    );
    expect(row.textContent).toMatch(/remote could not be reached/);
  });

  it("carries the dated observation line (freshness is provenance)", async () => {
    stubBoth([estateProject()], "2026-09-12T12:48:38Z");
    stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(screen.getAllByText("demo").length).toBeGreaterThanOrEqual(1)
    );
    const age = document.querySelector('[data-pw-projects-status="age"]')!;
    expect(age.textContent).toMatch(
      /by agent-sync — a dated observation, not live truth\./
    );
  });

  it("technical guts live behind a disclosure", async () => {
    stubBoth([estateProject({ project: "demo" })]);
    stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(screen.getAllByText("demo").length).toBeGreaterThanOrEqual(1)
    );
    expect(screen.getByText("Project details (technical)")).toBeTruthy();
    expect(
      document.querySelector('[data-pw-projects-guts="demo"]')
    ).toBeTruthy();
  });

  it("degrades quietly when agent-sync is unavailable (absent)", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/projects/status")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ ok: false, status: "unavailable", warnings: ["agent-sync observation unavailable"], data: null }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      if (path.includes("/api/source-control/history")) {
        return Promise.resolve(historyEnvelope(""));
      }
      return Promise.resolve(statusEnvelope([repo()]));
    });
    stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(screen.getByText("Watching your projects")).toBeTruthy()
    );
    expect(screen.queryByText("Agent-sync project estate")).toBeNull();
  });

  it("empty registry is honest, not an error", async () => {
    stubBoth([]);
    stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(screen.getByText("Watching your projects")).toBeTruthy()
    );
    expect(screen.queryByText("Agent-sync project estate")).toBeNull();
  });

  it("agent-sync section renders in a Disclosure", async () => {
    stubBoth([estateProject()]);
    stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(screen.getByText("Agent-sync project estate")).toBeTruthy()
    );
  });

  it("multiple projects render independently", async () => {
    stubBoth([
      estateProject({ project: "alpha" }),
      estateProject({ project: "beta" }),
      estateProject({ project: "gamma" }),
    ]);
    stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(screen.getAllByText("alpha").length).toBeGreaterThanOrEqual(1)
    );
    expect(screen.getAllByText("beta").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("gamma").length).toBeGreaterThanOrEqual(1);
  });

  it("agent-sync panel carries no error vocabulary", async () => {
    stubBoth([estateProject({ project: "healthy-proj" })]);
    const { container } = stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(screen.getAllByText("healthy-proj").length).toBeGreaterThanOrEqual(1)
    );
    const agentSection = screen.getByText("Agent-sync project estate").closest("details")!;
    expect(agentSection.textContent).not.toMatch(/ERROR|OUTDATED|DANGER/);
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("agent-sync panel is accessible", async () => {
    stubBoth([estateProject({ project: "split", publish_state: "diverged", safe_to_leave: "no" })]);
    const { container } = stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(screen.getAllByText("split").length).toBeGreaterThanOrEqual(1)
    );
    expect(screen.getByText("Agent-sync project estate")).toBeTruthy();
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });
});
