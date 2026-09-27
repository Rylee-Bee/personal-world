import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRoomEvents } from "../data/hooks";

class FakeSource {
  static last: FakeSource | null = null;
  url: string;
  closed = false;
  listeners: Record<string, (() => void)[]> = {};
  constructor(url: string) {
    this.url = url;
    FakeSource.last = this;
  }
  addEventListener(type: string, fn: () => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(type: string, fn: () => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn);
  }
  close() {
    this.closed = true;
  }
  fire(type: string) {
    for (const f of this.listeners[type] ?? []) f();
  }
}

function Listener() {
  useRoomEvents();
  return null;
}

describe("useRoomEvents", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("refreshes the rooms (and their views) when a room says it changed, and closes on unmount", () => {
    vi.stubGlobal("EventSource", FakeSource);
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const view = render(
      <QueryClientProvider client={qc}>
        <Listener />
      </QueryClientProvider>,
    );
    const source = FakeSource.last!;
    expect(source.url).toBe("/api/rooms/events");
    act(() => source.fire("room-changed"));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["rooms"] });
    view.unmount();
    expect(source.closed).toBe(true);
  });
});
