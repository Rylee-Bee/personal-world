/**
 * Tests for WorldKeeper — the one heartbeat (design/handoff/
 * WORLD_KEEPER.md, TRUE-NORTH).
 *
 * Guarantees:
 *  1. The artwork is the EXISTING companion art under public/ —
 *     deliberate artwork is reused, never regenerated; the bytes on
 *     disk are asserted like resident-presence.test.tsx does.
 *  2. The artwork is aria-hidden decoration (§7.2) and the component
 *     carries no live region of its own (§7.5) — the greet line
 *     beside it carries every word.
 *  3. The six canonical states travel as data-keeper-state; `sleep`
 *     gets a calm luminance-only rest treatment, never motion.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { existsSync } from "node:fs";
import { render, cleanup } from "@testing-library/react";
import { WorldKeeper } from "../components/WorldKeeper";
import { KEEPER_STATES } from "../screens/Overview/home-loop";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("WorldKeeper — artwork", () => {
  it("reuses the existing companion art under the deploy base", () => {
    const { container } = render(<WorldKeeper state="hello" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe(
      "/assets/characters/personal-world.png",
    );
  });

  it("joins against BASE_URL '/vnext/' (PW_VITE_BASE build)", () => {
    vi.stubEnv("BASE_URL", "/vnext/");
    const { container } = render(<WorldKeeper state="hello" />);
    const img = container.querySelector("img");
    expect(img!.getAttribute("src")).toBe(
      "/vnext/assets/characters/personal-world.png",
    );
  });

  it("points at real bytes on disk — never a regenerated asset", () => {
    const { container } = render(<WorldKeeper state="hello" />);
    const src = container.querySelector("img")!.getAttribute("src")!;
    expect(existsSync(`public${src}`)).toBe(true);
  });
});

describe("WorldKeeper — accessibility", () => {
  it("is hidden decoration with no announcements of its own", () => {
    const { container } = render(<WorldKeeper state="celebrate" />);
    const wrapper = container.firstElementChild!;
    expect(wrapper.getAttribute("aria-hidden")).toBe("true");
    expect(wrapper.getAttribute("role")).toBe("presentation");
    expect(container.querySelector("[aria-live]")).toBeNull();
    expect(container.querySelector("img")!.getAttribute("alt")).toBe("");
  });
});

describe("WorldKeeper — the six canonical states", () => {
  it("carries every WORLD_KEEPER state as data, not telemetry", () => {
    for (const state of KEEPER_STATES) {
      const { container, unmount } = render(<WorldKeeper state={state} />);
      expect(
        container.firstElementChild!.getAttribute("data-keeper-state"),
      ).toBe(state);
      unmount();
    }
  });

  it("rests with luminance only at sleep — no motion classes", () => {
    const { container } = render(<WorldKeeper state="sleep" />);
    const img = container.querySelector("img")!;
    expect(img.className).toContain("opacity-70");
    expect(img.className).toContain("saturate-50");
    expect(img.className).not.toMatch(/animate|transition|motion/);
  });

  it("greets at full luminance", () => {
    const { container } = render(<WorldKeeper state="hello" />);
    const img = container.querySelector("img")!;
    expect(img.className).not.toContain("opacity-70");
  });
});
