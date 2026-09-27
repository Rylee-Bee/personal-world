/**
 * Tests for the Rough night page (the calmest screen, owner wish
 * 2026-09-26). The hooks are mocked at the briefing door (the keeper
 * resident = the person's companion, same as the Bridge); the journal
 * write runs the real client through a mocked fetch, so the asserted
 * thing is the exact text that leaves the browser. Fixtures are the
 * server's shapes (worlds-briefing/1 keeper, the /api/journal
 * {text} write); no real names anywhere.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * api.ts builds its openapi-fetch client at module import, and that
 * client captures `globalThis.fetch` then — so the stub must exist
 * before the imports run: vi.hoisted is the only door.
 */
const { state, posts } = vi.hoisted(() => {
  const posts: { method: string; url: string; body: unknown }[] = [];
  const state = {
    resident: {
      key: "mira",
      name: "Mira",
      portrait: "/assets/crew/512/mira-portrait.webp",
    } as { key: string | null; name: string; portrait: string | null },
    fail: false,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(String(input));
      const body =
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.clone().json();
      posts.push({ method: request.method, url: request.url, body });
      if (state.fail) {
        return new Response(JSON.stringify({ detail: "no" }), { status: 500 });
      }
      return new Response(
        JSON.stringify({ ok: true, status: "healthy", data: { written: 42 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }),
  );
  return { state, posts };
});

vi.mock("../data/hooks", () => ({
  useBriefing: () => ({
    isPending: false,
    isError: false,
    data: { ok: true, data: { keeper: { resident: state.resident } } },
  }),
}));

import { RoughNight, roughNightText } from "../screens/RoughNight/RoughNight";

beforeEach(() => {
  posts.length = 0;
  state.fail = false;
  state.resident = {
    key: "mira",
    name: "Mira",
    portrait: "/assets/crew/512/mira-portrait.webp",
  };
});

afterEach(cleanup);

describe("RoughNight page", () => {
  it("renders the few words, top to bottom, with the companion's line spoken by name", () => {
    render(<RoughNight onBack={() => {}} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Rough night" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/I’m here\. Nothing needs you tonight\./),
    ).toBeInTheDocument();
    expect(screen.getByText("Mira:")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How bad is it?" })).toBeInTheDocument();
    for (const label of [
      "1 · A little",
      "2 · Hard to ignore",
      "3 · Bad",
      "4 · Very bad",
      "5 · The worst",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    const note = screen.getByLabelText("Anything else? (optional)");
    expect(note).toHaveProperty("rows", 3);
    expect(screen.getByRole("button", { name: "Save for my doctor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("marks only the chosen number pressed", async () => {
    const user = userEvent.setup();
    render(<RoughNight onBack={() => {}} />);
    const bad = screen.getByRole("button", { name: "3 · Bad" });
    const worst = screen.getByRole("button", { name: "5 · The worst" });
    expect(bad).toHaveAttribute("aria-pressed", "false");
    await user.click(bad);
    expect(bad).toHaveAttribute("aria-pressed", "true");
    expect(worst).toHaveAttribute("aria-pressed", "false");
    await user.click(worst);
    expect(worst).toHaveAttribute("aria-pressed", "true");
    expect(bad).toHaveAttribute("aria-pressed", "false");
  });

  it("saves the exact journal line, then says so quietly", async () => {
    const user = userEvent.setup();
    render(<RoughNight onBack={() => {}} />);
    const save = screen.getByRole("button", { name: "Save for my doctor" });
    // Nothing chosen yet → nothing to write.
    expect(save).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "2 · Hard to ignore" }));
    expect(save).toBeEnabled();
    await user.type(
      screen.getByLabelText("Anything else? (optional)"),
      "could not sleep through it",
    );
    await user.click(save);

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved to your journal."),
    );
    expect(posts).toHaveLength(1); // the one write, and no other traffic
    expect(posts[0].method).toBe("POST");
    expect(posts[0].url).toBe("http://station.test/api/journal");
    expect(posts[0].body).toEqual({
      text: expect.stringMatching(
        /^Rough night · 2\/5 · \d{2}:\d{2} · could not sleep through it #rough-night$/,
      ),
    });
  });

  it("leaves the note segment out when nothing was written", async () => {
    const user = userEvent.setup();
    render(<RoughNight onBack={() => {}} />);
    await user.click(screen.getByRole("button", { name: "4 · Very bad" }));
    await user.click(screen.getByRole("button", { name: "Save for my doctor" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved to your journal."),
    );
    expect(posts[0].body).toEqual({
      text: expect.stringMatching(/^Rough night · 4\/5 · \d{2}:\d{2} #rough-night$/),
    });
  });

  it("reports a failed save honestly instead of the saved line", async () => {
    state.fail = true;
    const user = userEvent.setup();
    render(<RoughNight onBack={() => {}} />);
    await user.click(screen.getByRole("button", { name: "1 · A little" }));
    await user.click(screen.getByRole("button", { name: "Save for my doctor" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Couldn’t save."));
    expect(screen.queryByText("Saved to your journal.")).not.toBeInTheDocument();
    // And the person can try again.
    expect(screen.getByRole("button", { name: "Save for my doctor" })).toBeEnabled();
  });

  it("says the line with no name and shows no portrait when nobody was chosen", () => {
    state.resident = { key: null, name: "Assistant", portrait: null };
    const { container } = render(<RoughNight onBack={() => {}} />);
    expect(screen.queryByText("Assistant:")).not.toBeInTheDocument();
    expect(screen.getByText("I’m here. Nothing needs you tonight.")).toBeInTheDocument();
    // No portrait: the only picture is Sol asleep, decorative and silent.
    const images = Array.from(container.querySelectorAll("img"));
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute("data-sol-mood")).toBe("sleeping");
    expect(images[0].getAttribute("alt")).toBe("");
  });

  it("shows the companion in their sleepy night pose, silent to screen readers", () => {
    const { container } = render(<RoughNight onBack={() => {}} />);
    const pose = container.querySelector("img[data-sleepy]");
    expect(pose?.getAttribute("data-sleepy")).toBe("mira");
    expect(pose?.getAttribute("src")).toMatch(/assets\/crew\/512\/mira-sleepy\.webp$/);
    expect(pose?.getAttribute("alt")).toBe("");
    // Still spoken by name in the words.
    expect(screen.getByText("Mira:")).toBeInTheDocument();
  });

  it("keeps the usual portrait for a companion someone added themselves", () => {
    state.resident = { key: "ori", name: "Ori", portrait: "/assets/crew/512/owl-portrait.webp" };
    const { container } = render(<RoughNight onBack={() => {}} />);
    expect(container.querySelector("img[data-sleepy]")).toBeNull();
    expect(container.querySelector('img[src$="owl-portrait.webp"]')).not.toBeNull();
  });

  it("marks the chosen level with a word as well as the border", async () => {
    const user = userEvent.setup();
    render(<RoughNight onBack={() => {}} />);
    const bad = screen.getByRole("button", { name: /3 · Bad/ });
    await user.click(bad);
    expect(bad).toHaveAttribute("aria-pressed", "true");
    expect(bad.textContent).toMatch(/chosen/);
    expect(screen.getByRole("button", { name: /4 · Very bad/ }).textContent).not.toMatch(/chosen/);
  });

  it("returns to the Bridge", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<RoughNight onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe("roughNightText — the one journal line", () => {
  it("is exactly the shaped line, local clock zero-padded", () => {
    const at = new Date(2026, 8, 26, 23, 7, 0);
    expect(roughNightText(3, "", at)).toBe("Rough night · 3/5 · 23:07 #rough-night");
    expect(roughNightText(5, "  pain, mostly  ", at)).toBe(
      "Rough night · 5/5 · 23:07 · pain, mostly #rough-night",
    );
    expect(roughNightText(1, "   ", new Date(2026, 0, 4, 0, 2, 0))).toBe(
      "Rough night · 1/5 · 00:02 #rough-night",
    );
  });
});
