/**
 * CompanionChooser: PUT /api/prefs is a step-up write (api.py). Before
 * 2026-09-27, a 403 here dead-ended with a generic "couldn't save" — no
 * way to actually confirm and finish the save.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../data/api";

const hookState = vi.hoisted(() => ({
  onError: undefined as ((err: unknown) => void) | undefined,
}));

vi.mock("../data/hooks", () => ({
  useCrew: () => ({ isPending: false, data: { data: [] } }),
  usePrefs: () => ({ isPending: false, data: { data: { companion_id: null } } }),
  usePutPrefs: () => ({
    isPending: false,
    mutate: (_vars: unknown, opts: { onError?: (e: unknown) => void }) => {
      hookState.onError = opts.onError;
    },
  }),
  useSession: () => ({ data: { data: { step_up_methods: ["key"] } } }),
  useStepUp: () => ({ isPending: false, mutate: vi.fn() }),
}));

import { CompanionChooser } from "../components/crew/CompanionChooser";

afterEach(() => cleanup());

function renderChooser() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <CompanionChooser />
    </QueryClientProvider>,
  );
}

describe("CompanionChooser", () => {
  it("offers Confirm it's you on a step-up 403, instead of a dead end", async () => {
    renderChooser();
    fireEvent.click(screen.getByRole("button", { name: /Assistant/ }));
    hookState.onError?.(new ApiError(403, "write requires step-up auth"));
    expect(await screen.findByText(/your sign-in key/i)).toBeInTheDocument();
    expect(screen.queryByText(/couldn.t save/i)).not.toBeInTheDocument();
  });

  it("still shows a plain error for a non-step-up failure, no confirm dialog", async () => {
    renderChooser();
    fireEvent.click(screen.getByRole("button", { name: /Assistant/ }));
    hookState.onError?.(new ApiError(500, "server exploded"));
    expect(await screen.findByText("server exploded")).toBeInTheDocument();
    expect(screen.queryByText(/Confirm it.s you/i)).not.toBeInTheDocument();
  });
});
