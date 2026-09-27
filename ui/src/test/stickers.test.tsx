/** The Sticker Album's pieces: every state said in words; secrets never drawn
 *  until found; the quiet landing settles, and is muted when asked. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { Sticker } from "../components/stickers/Sticker";
import { StickerPeel, PEEL_SETTLE_MS } from "../components/stickers/StickerPeel";
import { tiltFor } from "../components/stickers/tilt";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Sticker", () => {
  it("says its state in words: found with its shine, not yet, a riddle, a found secret", () => {
    render(
      <>
        <Sticker id="a" name="First Light" kind="open" shine="foil" found />
        <Sticker id="b" name="Hello, Crew" kind="open" shine="paper" found={false} />
        <Sticker id="c" name="Pocket Worlds" kind="riddle" shine="paper" found={false} />
        <Sticker id="d" name="Sol Says Hi" kind="secret" shine="holo" found />
      </>,
    );
    expect(screen.getByRole("button", { name: "First Light, found. Turn it over." })).toHaveTextContent("Gold foil");
    expect(screen.getByRole("button", { name: "Hello, Crew, not found yet. Turn it over." })).toHaveTextContent("Not yet");
    // A riddle keeps its name hidden.
    const riddle = screen.getByRole("button", { name: "A riddle. Turn it over." });
    expect(riddle).not.toHaveTextContent("Pocket Worlds");
    expect(screen.getByRole("button", { name: "Sol Says Hi, found. Turn it over." })).toHaveTextContent("Holo · secret");
  });

  it("turns over when pressed, and always sits at the same small tilt", () => {
    const onTurnOver = vi.fn();
    render(<Sticker id="first-light" name="First Light" kind="open" shine="paper" found onTurnOver={onTurnOver} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onTurnOver).toHaveBeenCalledOnce();
    expect(tiltFor("first-light")).toBe(tiltFor("first-light"));
    expect(Math.abs(tiltFor("first-light"))).toBeLessThanOrEqual(6);
  });
});

describe("StickerPeel", () => {
  it("lands quietly, settles when ignored, then goes (it's already in the album)", () => {
    vi.useFakeTimers();
    const { container } = render(<StickerPeel id="a" name="First Light" shine="paper" />);
    expect(screen.getByRole("complementary", { name: "New sticker" })).toHaveTextContent("New sticker: First Light");
    act(() => vi.advanceTimersByTime(PEEL_SETTLE_MS + 1));
    expect(container.querySelector(".sticker-peel-settled")).not.toBeNull();
    act(() => vi.advanceTimersByTime(PEEL_SETTLE_MS + 1));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing at all when muted (dim mode, Rough night)", () => {
    const { container } = render(<StickerPeel id="a" name="First Light" shine="paper" muted />);
    expect(container).toBeEmptyDOMElement();
  });
});
