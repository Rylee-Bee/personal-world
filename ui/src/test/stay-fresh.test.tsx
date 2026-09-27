import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";

const live = vi.hoisted(() => ({ commit: "aaaaaaa" as string | null }));
vi.mock("../data/api", () => ({ healthz: async () => ({ commit: live.commit }) }));

import { StayFresh } from "../app/StayFresh";

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function comeBack() {
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await settle();
}

describe("StayFresh", () => {
  beforeEach(() => {
    live.commit = "aaaaaaa";
  });
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("does nothing while the same build is live", async () => {
    const reload = vi.fn();
    render(<StayFresh reload={reload} />);
    await settle();
    await comeBack();
    expect(reload).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("reloads when the person comes back and a newer build is live", async () => {
    const reload = vi.fn();
    render(<StayFresh reload={reload} />);
    await settle();
    live.commit = "bbbbbbb";
    await comeBack();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("never reloads under someone mid-typing; says so and offers Reload", async () => {
    const reload = vi.fn();
    render(
      <>
        <textarea defaultValue="half a thought" />
        <StayFresh reload={reload} />
      </>,
    );
    await settle();
    live.commit = "bbbbbbb";
    await comeBack();
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Worlds was updated.");
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("ignores builds with no commit (local or dev)", async () => {
    live.commit = null;
    const reload = vi.fn();
    render(<StayFresh reload={reload} />);
    await settle();
    live.commit = "bbbbbbb";
    await comeBack();
    expect(reload).not.toHaveBeenCalled();
  });
});
