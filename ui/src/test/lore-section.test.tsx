import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";

const h = vi.hoisted(() => ({
  sync: vi.fn(),
  confirm: vi.fn(),
  lore: { data: { items: [], counts: { suggested: 3, confirmed: 1 }, accepted_waiting: 2 } },
}));
vi.mock("../data/hooks", () => ({
  useLore: () => ({ data: { data: h.lore.data }, isLoading: false }),
  useLoreSync: () => ({ mutate: h.sync, isPending: false, variables: undefined }),
  useLoreConfirm: () => ({ mutate: h.confirm, isPending: false }),
  useSession: () => ({ data: { data: { step_up_methods: ["key"] } } }),
  useStepUp: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { LoreSection } from "../screens/Settings/LoreSection";

type Cb = { onSuccess: (r: unknown) => void; onError: (e: unknown) => void };

describe("Your lore", () => {
  afterEach(cleanup);

  it("says what's here, previews a sync without changing anything, and names what stays out", () => {
    render(<LoreSection />);
    expect(screen.getByText("1 confirmed · 3 waiting for you")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check for changes" }));
    const [dry, cb] = h.sync.mock.calls[0] as [boolean, Cb];
    expect(dry).toBe(true);
    act(() =>
      cb.onSuccess({
        data: {
          counts: { new: 5, changed: 1, unchanged: 0, confirmed_kept: 0, gone: 0, accepted_waiting: 2 },
          skipped: { "pain-research": 18, "context/vault": 2 },
          dry_run: true, source: "rylee_lore", revision: "x", room: "engine-room",
        },
      }),
    );
    expect(screen.getByText("5 new items, 1 changed item.")).toBeInTheDocument();
    expect(screen.getByText(/Kept out on purpose: 18 medical notes, 2 encrypted notes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bring it in" }));
    expect(h.sync.mock.calls[1][0]).toBe(false);
  });

  it("confirms the accepted ones with one tap", () => {
    render(<LoreSection />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm the 2 accepted ones" }));
    expect(h.confirm.mock.calls[0][0]).toEqual({ accepted: true });
  });
});
