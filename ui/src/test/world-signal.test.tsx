/**
 * Tests for WorldSignal — the technical-detail disclosure (EYES-ON V3).
 *
 * The card's visible line is plain language; the raw wire string is
 * never lost, it is one tap away on the card itself ("technical depth
 * on demand, not forced" — PRODUCT-LANGUAGE.md).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorldSignal } from "../components/WorldSignal";

afterEach(() => {
  cleanup();
});

describe("WorldSignal — technical detail disclosure", () => {
  it("keeps the raw wire string behind the disclosure and out of the headline", async () => {
    render(
      <WorldSignal
        level="update"
        title="Source control needs your attention."
        technical="source_control: needs_attention"
      />,
    );
    expect(screen.getByText("Source control needs your attention.")).toBeInTheDocument();
    // Collapsed by default — depth is on demand, not forced.
    expect(screen.queryByText("source_control: needs_attention")).not.toBeVisible();
    await userEvent.click(screen.getByText("Technical detail"));
    const detail = screen.getByText("source_control: needs_attention");
    expect(detail).toBeVisible();
    expect(detail.tagName).toBe("CODE");
  });

  it("renders no disclosure at all when there is nothing technical to show", () => {
    render(
      <WorldSignal
        level="good"
        title="All systems healthy"
        description="4 capabilities connected, nothing needs attention."
      />,
    );
    expect(screen.queryByText("Technical detail")).not.toBeInTheDocument();
  });
});
