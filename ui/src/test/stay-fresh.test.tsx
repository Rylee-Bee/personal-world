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
    sessionStorage.clear();
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

  it("an old page (its baked build is behind the live one) reloads as it opens", async () => {
    const reload = vi.fn();
    render(<StayFresh reload={reload} built="0000000" />);
    await settle();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads at most once per live build, then shows the quiet line", async () => {
    sessionStorage.setItem("pw-stayfresh-reloaded-for", "aaaaaaa");
    const reload = vi.fn();
    render(<StayFresh reload={reload} built="0000000" />);
    await settle();
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("Worlds was updated");
  });

  it("a page whose baked build is live stays put", async () => {
    const reload = vi.fn();
    render(<StayFresh reload={reload} built="aaaaaaa" />);
    await settle();
    await comeBack();
    expect(reload).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
