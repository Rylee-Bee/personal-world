/**
 * Tests for ResidentPresence — the avatar defect class (EYES-ON V1).
 *
 * Two guarantees:
 *  1. Artwork paths are joined against Vite's deploy base, so a build
 *     served under /vnext/ resolves its images under /vnext/ too —
 *     the bug was a hard-coded root-absolute "/assets/…" string that
 *     Vite's build-time rewriting never touches.
 *  2. A resident WITHOUT art (unknown id, or an <img> that 404s at
 *     runtime) gets an honest initial-letter medallion — never a
 *     broken-image glyph, never another resident's art.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ResidentPresence } from "../components/ResidentPresence";
import { COMPANION_RESIDENTS } from "../data/types";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("ResidentPresence — artwork resolves under the deploy base", () => {
  it("joins public asset paths against BASE_URL '/' (default build)", () => {
    const { container } = render(
      <ResidentPresence resident={{ id: "renai", name: "Renai" }} />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("/assets/characters/renai.png");
  });

  it("joins against BASE_URL '/vnext/' (PW_VITE_BASE=/vnext/ build)", () => {
    vi.stubEnv("BASE_URL", "/vnext/");
    const { container } = render(
      <ResidentPresence resident={{ id: "renai", name: "Renai" }} />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe(
      "/vnext/assets/characters/renai.png",
    );
  });

  it("has real art files in public/ for every canon companion resident", () => {
    // Guards the other half of the defect: the map keying AND the
    // bytes on disk. A missing file here is D4-owner territory —
    // the UI must know about it, not paper over it. Vitest runs with
    // the project root as cwd, so these are stable relative paths.
    vi.stubEnv("BASE_URL", "/vnext/");
    const served = new Set(readdirSync("public/assets/characters"));
    for (const resident of Object.values(COMPANION_RESIDENTS)) {
      const { container } = render(
        <ResidentPresence resident={resident} />,
      );
      const img = container.querySelector("img");
      expect(img, `${resident.id} should render art`).not.toBeNull();
      const relative = img!.getAttribute("src")!.replace("/vnext", "");
      expect(existsSync(`public${relative}`), `public${relative}`).toBe(true);
      expect(served.has(`${resident.id}.png`)).toBe(true);
    }
  });
});

describe("ResidentPresence — honest fallback medallion, never fake art", () => {
  it("shows an initial-letter medallion, not an image, for a resident without art", () => {
    const { container } = render(
      <ResidentPresence resident={{ id: "no-art-unknown", name: "Nyx" }} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("N")).toBeInTheDocument();
    // The name is still plainly present.
    expect(screen.getByText("Nyx")).toBeInTheDocument();
  });

  it("does not borrow Renai's art for an unknown resident (no fake presence)", () => {
    const { container } = render(
      <ResidentPresence resident={{ id: "whoever", name: "Whoever" }} />,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("swaps the medallion in when the art fails to load (no broken-image glyph)", () => {
    const { container } = render(
      <ResidentPresence resident={{ id: "renai", name: "Renai" }} />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    fireEvent.error(img!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("R")).toBeInTheDocument();
  });

  it("renders the medallion for an empty name without crashing", () => {
    const { container } = render(
      <ResidentPresence resident={{ id: "blank", name: "  " }} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("✦");
  });
});
