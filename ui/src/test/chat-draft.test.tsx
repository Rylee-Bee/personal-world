/**
 * "Ask about this in Chat": another screen hands Chat a question; it
 * lands in the box unsent, and only the person's own Send sends it.
 */
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const send = vi.fn();
const hookState = vi.hoisted(() => ({
  briefing: {
    data: {
      ok: true,
      data: { keeper: { resident: { key: "renai", name: "Renai", portrait: "/assets/crew/256/renai-listening.webp" } } },
    },
  } as { data: unknown },
}));
vi.mock("../data/hooks", () => ({
  useChatHistory: () => ({ isLoading: false, data: { ok: true, data: { entries: [] } } }),
  useChatProviders: () => ({ data: { ok: true, data: { active: "ollama", providers: [{ name: "ollama", available: true }] } } }),
  useSendChat: () => ({ mutate: send, isPending: false, isError: false }),
  useToneRegister: () => "warm",
  useBriefing: () => hookState.briefing,
}));

import { Chat } from "../screens/Chat/Chat";

describe("Chat — a question from another screen", () => {
  afterEach(cleanup);

  it("starts with the question in the box, unsent", () => {
    render(<Chat draft={{ id: 1, text: "What changed in Studio since I last looked?" }} />);
    expect(screen.getByRole("textbox")).toHaveValue("What changed in Studio since I last looked?");
    expect(send).not.toHaveBeenCalled();
  });

  it("says who answers: the chosen companion, or Worlds when the crew is off", () => {
    const { unmount } = render(<Chat />);
    expect(screen.getByRole("heading", { level: 1, name: "Chat with Renai" })).toBeInTheDocument();
    expect(screen.getByLabelText("Message input")).toBeInTheDocument();
    unmount();
    hookState.briefing = { data: { ok: true, data: { keeper: { resident: { key: null, name: "Worlds", portrait: null } } } } };
    render(<Chat />);
    expect(screen.getByRole("heading", { level: 1, name: "Chat with Worlds" })).toBeInTheDocument();
  });

  it("starts empty with no question", () => {
    render(<Chat />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });
});
