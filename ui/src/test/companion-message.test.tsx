/**
 * Companion messages (board Companion-Messages): one line, only when
 * something meaningful happened, at most one every 30 seconds, dismissible,
 * and silent on a quiet day.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { BridgeData } from "../data/contract";

const hookState = vi.hoisted(() => ({
  rooms: { isPending: true, data: undefined } as { isPending: boolean; data: unknown },
  journal: { isPending: true, data: undefined } as { isPending: boolean; data: unknown },
}));
vi.mock("../data/hooks", () => ({
  useRooms: () => hookState.rooms,
  useJournalList: () => hookState.journal,
}));
import { CompanionMessage } from "../screens/Bridge/CompanionMessage";
import { composeMessage, setMessagesMode } from "../screens/Bridge/companionMessages";

function data(arrived: number, needs: number, since = "2026-09-25T09:00:00Z"): BridgeData {
  return {
    schema: "worlds-briefing/1",
    generated_at: "2026-09-26T09:00:00Z",
    since,
    keeper: { name: null, resident: { key: "renai", name: "Renai", portrait: null } },
    systems: [{ id: "agents", counts: { arrivals: arrived } }],
    have_tos: [],
    have_tos_total: needs,
    arrivals: arrived ? [{ title: "New build is ready" }] : [],
    thread: null,
  } as unknown as BridgeData;
}

beforeEach(() => {
  window.localStorage.clear();
  hookState.rooms = { isPending: true, data: undefined };
  hookState.journal = { isPending: true, data: undefined };
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-26T09:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("composeMessage", () => {
  it("says nothing on a quiet day", () => {
    expect(composeMessage(data(0, 0), "all")).toBeNull();
  });
  it("names what came in and what needs you", () => {
    expect(composeMessage(data(2, 1), "all")?.text).toBe(
      "2 new things came in since you were here, and 1 thing needs you. Newest: “New build is ready”.",
    );
  });
  it("in 'only when something needs me', ignores arrivals", () => {
    expect(composeMessage(data(3, 0), "needs")).toBeNull();
    expect(composeMessage(data(3, 2), "needs")?.text).toBe("2 things need you, whenever you're ready.");
  });
});

describe("CompanionMessage", () => {
  it("speaks once in the companion's voice, and dismissing sticks", () => {
    const { rerender } = render(<CompanionMessage data={data(1, 0)} />);
    act(() => void vi.advanceTimersByTime(0));
    expect(screen.getByText("Renai:")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Renai:")).toBeNull();
    rerender(<CompanionMessage data={data(1, 0)} />);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(screen.queryByText("Renai:")).toBeNull();
  });

  it("waits out the 30-second gap, then says what's true then", () => {
    const { rerender } = render(<CompanionMessage data={data(1, 0)} />);
    act(() => void vi.advanceTimersByTime(0));
    expect(screen.getByText(/1 new thing came in/)).toBeInTheDocument();
    rerender(<CompanionMessage data={data(2, 1)} />);
    act(() => void vi.advanceTimersByTime(10_000));
    expect(screen.queryByText(/2 new things came in/)).toBeNull();
    act(() => void vi.advanceTimersByTime(20_000));
    expect(screen.getByText(/2 new things came in since you were here, and 1 thing needs you/)).toBeInTheDocument();
  });

  it("stays quiet while the first-day guide is speaking", () => {
    hookState.rooms = { isPending: false, data: { ok: true, data: [] } };
    hookState.journal = { isPending: false, data: { ok: true, data: [] } };
    render(<CompanionMessage data={data(3, 2)} />);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });

  it("is silent when turned off", () => {
    setMessagesMode("off");
    render(<CompanionMessage data={data(3, 2)} />);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });
});
