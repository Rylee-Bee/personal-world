/**
 * Tests for JournalGateTool (Settings/Advanced, journal_gate design
 * 2026-09-27): agent list + revoke, the audit log, and the denylist
 * editor. Same pattern as settings-room.test.tsx — the data layer is
 * mocked at the hooks boundary; the component's job is to render the
 * server vocabulary honestly and never invent data on load/error.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// jsdom does not implement <dialog>'s showModal()/close() (no native
// modal/rendering support); this file is the only place that needs
// them (RevokeSection's confirm dialog), so a small local shim beats
// a global test-setup change. It only toggles the `open` attribute —
// enough for the component's own open-state effect to work.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}

const { revokeMutate, putDenylistMutate, mocks } = vi.hoisted(() => {
  const revokeMutate = vi.fn(
    (
      _agentId: string,
      options?: { onSuccess?: () => void; onError?: (e: Error) => void },
    ) => {
      options?.onSuccess?.();
    },
  );
  const putDenylistMutate = vi.fn(
    (
      _body: unknown,
      options?: { onSuccess?: () => void; onError?: (e: Error) => void },
    ) => {
      options?.onSuccess?.();
    },
  );
  const mocks = {
    agents: {
      isLoading: false,
      error: null as Error | null,
      agents: [] as {
        user_id: string;
        display_name: string;
        owner_id: string;
        scopes: string[];
        enabled: boolean;
        created_at: number;
      }[],
    },
    log: {
      isLoading: false,
      error: null as Error | null,
      data: { data: { entries: [] as Record<string, unknown>[] } },
    },
    denylist: {
      isLoading: false,
      error: null as Error | null,
      data: { data: { blocked_agents: [] as string[], blocked_topics: [] as string[] } },
    },
  };
  return { revokeMutate, putDenylistMutate, mocks };
});

vi.mock("../data/hooks", () => ({
  useJournalGateAgents: () => mocks.agents,
  useRevokeAgent: () => ({ isPending: false, mutate: revokeMutate }),
  useJournalGateLog: () => mocks.log,
  useJournalGateDenylist: () => mocks.denylist,
  usePutJournalGateDenylist: () => ({ isPending: false, mutate: putDenylistMutate }),
}));

import { JournalGateTool } from "../screens/Settings/JournalGateTool";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.agents.agents = [];
  mocks.agents.isLoading = false;
  mocks.agents.error = null;
  mocks.log.data = { data: { entries: [] } };
  mocks.log.isLoading = false;
  mocks.log.error = null;
  mocks.denylist.data = { data: { blocked_agents: [], blocked_topics: [] } };
  mocks.denylist.isLoading = false;
  mocks.denylist.error = null;
});

describe("JournalGateTool — agents", () => {
  it("shows an honest empty state with no scoped agents", () => {
    render(<JournalGateTool />);
    expect(screen.getByText(/no agent currently holds gate access/i)).toBeInTheDocument();
  });

  it("lists a scoped agent and revokes it through the confirm dialog", async () => {
    mocks.agents.agents = [
      {
        user_id: "gatebot",
        display_name: "gatebot",
        owner_id: "beta",
        scopes: ["journal_gate"],
        enabled: true,
        created_at: 1_700_000_000,
      },
    ];
    const user = userEvent.setup();
    render(<JournalGateTool />);

    expect(screen.getByText("gatebot")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /revoke gate access for gatebot/i }));

    const dialog = screen.getByRole("alertdialog", { name: /revoke gate access/i });
    expect(within(dialog).getByText(/gatebot/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /^confirm revoke gatebot$/i }));
    expect(revokeMutate).toHaveBeenCalledWith("gatebot", expect.anything());
    await waitFor(() => expect(screen.getByText(/revoked gatebot/i)).toBeInTheDocument());
  });

  it("cancel on the confirm dialog does not revoke", async () => {
    mocks.agents.agents = [
      {
        user_id: "gatebot",
        display_name: "gatebot",
        owner_id: "beta",
        scopes: ["journal_gate"],
        enabled: true,
        created_at: 1_700_000_000,
      },
    ];
    const user = userEvent.setup();
    render(<JournalGateTool />);
    await user.click(screen.getByRole("button", { name: /revoke gate access for gatebot/i }));
    await user.click(screen.getByRole("button", { name: /cancel revoke/i }));
    expect(revokeMutate).not.toHaveBeenCalled();
  });

  it("surfaces a load error honestly instead of an empty list", () => {
    mocks.agents.error = new Error("network down");
    render(<JournalGateTool />);
    expect(screen.getByText(/network down/i)).toBeInTheDocument();
    expect(screen.queryByText(/no agent currently holds/i)).not.toBeInTheDocument();
  });
});

describe("JournalGateTool — log", () => {
  it("shows an honest empty state with no asks yet", () => {
    render(<JournalGateTool />);
    expect(screen.getByText(/no asks yet/i)).toBeInTheDocument();
  });

  it("renders a structured log entry, never raw journal text", () => {
    mocks.log.data = {
      data: {
        entries: [
          {
            ts: "2026-09-27T10:00:00Z",
            caller_id: "agent:gatebot",
            ask: "relates_to",
            topic: "migraine",
            window_days: 7,
            answer: "yes",
            model_mode: "mock",
          },
        ],
      },
    };
    render(<JournalGateTool />);
    expect(screen.getByText(/agent:gatebot/)).toBeInTheDocument();
    expect(screen.getByText(/relates_to/)).toBeInTheDocument();
    expect(screen.getByText(/migraine/)).toBeInTheDocument();
    expect(screen.getByText(/no model configured/i)).toBeInTheDocument();
  });
});

describe("JournalGateTool — denylist", () => {
  it("pre-fills the form from the server's current list and saves parsed arrays", async () => {
    mocks.denylist.data = {
      data: { blocked_agents: ["agent:snoopbot"], blocked_topics: ["migraine", "scuba"] },
    };
    const user = userEvent.setup();
    render(<JournalGateTool />);

    const topicsBox = screen.getByLabelText(/topics \(one per line\)/i) as HTMLTextAreaElement;
    const agentsBox = screen.getByLabelText(/agent ids \(one per line\)/i) as HTMLTextAreaElement;
    expect(topicsBox.value).toBe("migraine\nscuba");
    expect(agentsBox.value).toBe("agent:snoopbot");

    await user.type(topicsBox, "\nkayaking");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(putDenylistMutate).toHaveBeenCalledWith(
      {
        blocked_topics: ["migraine", "scuba", "kayaking"],
        blocked_agents: ["agent:snoopbot"],
      },
      expect.anything(),
    );
    await waitFor(() => expect(screen.getByText(/^saved\.$/i)).toBeInTheDocument());
  });

  it("names step-up plainly, matching the server's own gate on the write", () => {
    render(<JournalGateTool />);
    expect(screen.getByText(/requires step-up authentication/i)).toBeInTheDocument();
  });
});
