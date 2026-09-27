/**
 * Book Girl: she offers the name for something just made, only when asked,
 * in the words of the idea's own book; ignored, she settles and nothing is
 * counted; "Got it" tells Worlds and returns focus to her.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";

const h = vi.hoisted(() => ({ gotIt: vi.fn() }));
vi.mock("../data/hooks", () => ({ useLearningGotIt: () => ({ mutate: h.gotIt, isPending: false }) }));

import { LearnMoment, SETTLE_MS } from "../components/bookgirl/LearnMoment";

afterEach(() => {
  cleanup();
  h.gotIt.mockClear();
  vi.useRealTimers();
});

describe("LearnMoment", () => {
  it("offers the word only when tapped, from the idea's book, and Got it tells Worlds", () => {
    render(<LearnMoment moment={{ concept: "gating", stage: "first" }} />);
    const her = screen.getByRole("button", { name: "There’s a name for something you just made (optional)" });
    expect(her.querySelector("svg")?.getAttribute("data-pose")).toBe("flying");
    expect(screen.queryByText(/There’s a name for part of what you just made/)).toBeNull();

    fireEvent.click(her);
    expect(her.querySelector("svg")?.getAttribute("data-pose")).toBe("resting");
    expect(screen.getByRole("status")).toHaveTextContent(
      "📚 There’s a name for part of what you just made. Gating: getting to something depends on meeting a condition first.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Why designers use this" }));
    expect(screen.getByRole("status")).toHaveTextContent(/Designers use gates to pace a story/);

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(h.gotIt).toHaveBeenCalledWith("gating");
    expect(screen.getByText("She’ll get quieter about gating from here.")).toBeInTheDocument();
    expect(her).toHaveFocus();
  });

  it("connects a second time to where the idea was first met", () => {
    render(<LearnMoment moment={{ concept: "gating", stage: "again", first_context: "the hidden door that needed the lantern" }} />);
    fireEvent.click(screen.getByRole("button", { name: /There’s a name/ }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "📚 You’ve seen this idea before. Remember the hidden door that needed the lantern? Same idea: Gating.",
    );
  });

  it("settles down on her own when ignored, and nothing is counted", () => {
    vi.useFakeTimers();
    render(<LearnMoment moment={{ concept: "signposting", stage: "first" }} />);
    const her = screen.getByRole("button", { name: /There’s a name/ });
    act(() => vi.advanceTimersByTime(SETTLE_MS + 10));
    expect(her.querySelector("svg")?.getAttribute("data-pose")).toBe("settled");
    expect(h.gotIt).not.toHaveBeenCalled();
  });

  it("shows nothing for a familiar idea or plain words", () => {
    const { container: a } = render(<LearnMoment moment={{ concept: "gating", stage: "familiar" }} />);
    expect(a).toBeEmptyDOMElement();
    const { container: b } = render(<LearnMoment moment={{ concept: "gating", stage: "off" }} />);
    expect(b).toBeEmptyDOMElement();
  });
});
