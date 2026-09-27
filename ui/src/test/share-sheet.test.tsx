import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";

const h = vi.hoisted(() => ({ remember: vi.fn(async () => ({ ok: true, data: { kept: "later" } })) }));
vi.mock("../data/api", () => ({ remember: h.remember }));

import { ShareSheet } from "../app/ShareSheet";

describe("ShareSheet", () => {
  afterEach(() => {
    cleanup();
    window.location.href = "http://station.test/";
  });

  it("shows nothing without something shared", () => {
    render(<ShareSheet />);
    expect(screen.queryByText("Keep this?")).toBeNull();
  });

  it("keeps a shared link on the Later shelf only when tapped, then clears the address", async () => {
    window.location.href = "http://station.test/?share_title=Hidden%20doors&share_url=https%3A%2F%2Fexample.test%2Fa";
    render(<ShareSheet />);
    expect(screen.getByText("Keep this?")).toBeInTheDocument();
    expect(h.remember).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Later" }));
    });
    expect(h.remember).toHaveBeenCalledWith("Hidden doors\nhttps://example.test/a", true);
    expect(screen.getByText("Kept on your Later shelf.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Later" })).toBeNull();
  });
});
