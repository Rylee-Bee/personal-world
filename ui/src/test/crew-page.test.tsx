/**
 * Tests for the Crew page (companions are user-owned, owner 2026-09-25;
 * its own page from Settings, owner 2026-09-26). The data hooks are
 * mocked; the fixtures are the server's shapes (crew.py, GET /api/rooms).
 * The assertions: companions and keepers in words, the commbadge for a
 * companion with no picture, starters can be hidden but not deleted, and
 * every write goes through the one matching endpoint.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import type { CrewEntry, RoomRow } from "../data/contract";

const { spies, state } = vi.hoisted(() => ({
  spies: {
    add: vi.fn(),
    patch: vi.fn(),
    remove: vi.fn(),
    upload: vi.fn(),
    put: vi.fn(),
  },
  state: {
    crew: [] as unknown[],
    rooms: [] as unknown[],
    companionId: null as string | null,
  },
}));

const mutation = (mutate: unknown) => ({
  mutate,
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null,
  data: undefined,
});

vi.mock("../data/hooks", () => ({
  useCrew: () => ({ isPending: false, isError: false, data: { ok: true, data: state.crew } }),
  useRooms: () => ({ isPending: false, isError: false, data: { ok: true, data: state.rooms } }),
  usePrefs: () => ({ data: { ok: true, data: { companion_id: state.companionId } } }),
  useAddCrew: () => mutation(spies.add),
  usePatchCrew: () => mutation(spies.patch),
  useDeleteCrew: () => mutation(spies.remove),
  useUploadCrewPortrait: () => mutation(spies.upload),
  usePutRoomKeeper: () => mutation(spies.put),
}));

import { Crew } from "../screens/Crew/Crew";

function entry(id: string, name: string, over: Partial<CrewEntry> = {}): CrewEntry {
  return {
    id,
    name,
    blurb: null,
    voice_label: null,
    portrait_asset: `/assets/crew/512/${id}-portrait.webp`,
    full_body_asset: null,
    source: "starter",
    hidden: false,
    ...over,
  };
}

function roomRow(id: string, name: string, keeper: RoomRow["keeper"] = null): RoomRow {
  return {
    id,
    base_url: `https://${id}.test`,
    reachable: true,
    status: "healthy",
    room: {
      contract: "room/0",
      id,
      name,
      icon: "book",
      version: "1",
      commit: "abc",
      status: "healthy",
      updated_at: "2026-09-25T00:00:00Z",
    },
    needs_you: [],
    error: null,
    checked_at: "2026-09-25T00:00:00Z",
    last_seen: "2026-09-25T00:00:00Z",
    keeper,
  };
}

beforeEach(() => {
  Object.values(spies).forEach((s) => s.mockClear());
  state.crew = [
    entry("bolt", "Bolt"),
    entry("mira", "Mira"),
    entry("pip", "Pip", { source: "user", portrait_asset: null, blurb: "Tends the garden" }),
    entry("hekek", "Hekek", { hidden: true }),
  ];
  state.rooms = [
    roomRow("workshop", "Workshop", { id: "bolt", name: "Bolt", portrait_url: null, initial: "B" }),
    roomRow("studio", "Studio", { id: "mira", name: "Mira", portrait_url: null, initial: "M" }),
  ];
  state.companionId = "pip";
});

afterEach(cleanup);

describe("Crew page", () => {
  it("lists the crew in words: who keeps what, who is yours, and Sol is not a companion", () => {
    render(<Crew onBack={() => {}} />);
    expect(screen.getByRole("heading", { level: 1, name: "Your crew" })).toBeInTheDocument();
    expect(screen.getByText(/She isn’t a companion/)).toBeInTheDocument();

    const bolt = screen.getByRole("listitem", { name: "Bolt" });
    expect(within(bolt).getByText("Keeps Workshop")).toBeInTheDocument();
    expect(within(bolt).getByText("Starter crew")).toBeInTheDocument();

    const pip = screen.getByRole("listitem", { name: "Pip" });
    expect(within(pip).getByText("No room · free to wander · your companion")).toBeInTheDocument();
    expect(within(pip).getByText("Added by you")).toBeInTheDocument();

    // Hidden companions aren't in the list, but can be brought back.
    expect(screen.queryByRole("listitem", { name: "Hekek" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /1 hidden/ }));
    fireEvent.click(screen.getByRole("button", { name: "Bring Hekek back" }));
    expect(spies.patch).toHaveBeenCalledWith({ id: "hekek", hidden: false });
  });

  it("gives a companion with no picture the crew commbadge, decoratively", () => {
    const { container } = render(<Crew onBack={() => {}} />);
    const pip = screen.getByRole("listitem", { name: "Pip" });
    const badge = pip.querySelector("img[src$='assets/crew/256/sol-badge.webp']");
    expect(badge).not.toBeNull();
    expect(badge).toHaveAttribute("alt", "");
    for (const img of Array.from(container.querySelectorAll("img"))) {
      expect(img).toHaveAttribute("alt", "");
    }
  });

  it("hides a companion, and only offers delete for your own", () => {
    render(<Crew onBack={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Hide Bolt" }));
    expect(spies.patch).toHaveBeenCalledWith({ id: "bolt", hidden: true });

    fireEvent.click(screen.getByRole("button", { name: "Edit Bolt" }));
    expect(screen.queryByRole("button", { name: "Delete…" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Edit Pip" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete…" }));
    expect(screen.getByText(/This can’t be undone/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete Pip" }));
    expect(spies.remove).toHaveBeenCalledWith("pip");
  });

  it("moves a room's keeper, or clears it back to the room's emblem", () => {
    render(<Crew onBack={() => {}} />);
    const studio = screen.getByRole("combobox", { name: "Keeper for Studio" });
    expect(studio).toHaveValue("mira");
    fireEvent.change(studio, { target: { value: "pip" } });
    expect(spies.put).toHaveBeenCalledWith({ roomId: "studio", companionId: "pip" });
    fireEvent.change(screen.getByRole("combobox", { name: "Keeper for Workshop" }), { target: { value: "" } });
    expect(spies.put).toHaveBeenCalledWith({ roomId: "workshop", companionId: null });
  });

  it("adds a companion with only a name required", () => {
    render(<Crew onBack={() => {}} />);
    const add = screen.getByRole("button", { name: "Add to your crew" });
    const form = add.closest("form")!;
    fireEvent.change(within(form).getByLabelText("Name"), { target: { value: "  Nova  " } });
    fireEvent.submit(form);
    expect(spies.add).toHaveBeenCalledWith({ name: "Nova" }, expect.anything());
  });

  it("chooses a doorway for a room on this device, and can go back to the room's own art", () => {
    window.localStorage.removeItem("pw-room-doorways");
    render(<Crew onBack={() => {}} />);
    const door = screen.getByRole("combobox", { name: "Doorway for Studio" });
    // Nothing is assigned automatically: Studio has no painted room.
    expect(door).toHaveValue("");
    expect(within(door).getByRole("option", { name: "A plain lantern arch" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("combobox", { name: "Doorway for Workshop" })).getByRole("option", {
        name: "Its own painted room",
      }),
    ).toBeInTheDocument();
    fireEvent.change(door, { target: { value: "study" } });
    expect(JSON.parse(window.localStorage.getItem("pw-room-doorways") ?? "{}")).toEqual({ studio: "study" });
    expect(door).toHaveValue("study");
    fireEvent.change(door, { target: { value: "" } });
    expect(JSON.parse(window.localStorage.getItem("pw-room-doorways") ?? "{}")).toEqual({});
  });

  it("offers library faces as a labelled radio group, suggesting a name and story you can change", () => {
    render(<Crew onBack={() => {}} />);
    const add = screen.getByRole("button", { name: "Add to your crew" });
    const form = add.closest("form")!;
    const group = within(form).getByRole("group", { name: "Choose a face (optional)" });
    expect(within(group).getAllByRole("radio")).toHaveLength(16);
    fireEvent.click(within(group).getByRole("radio", { name: "Owl" }));
    expect(within(form).getByLabelText("Name")).toHaveValue("Ori");
    expect((within(form).getByLabelText("A few words about them") as HTMLInputElement).value).toContain("constellation");
    expect(within(form).getByText(/Ori · Owl\./)).toBeInTheDocument();
    fireEvent.click(within(group).getByRole("radio", { name: "Fox" }));
    expect(within(form).getByLabelText("Name")).toHaveValue("Fenn");
    expect((within(form).getByLabelText("A few words about them") as HTMLInputElement).value).toContain("satchel");
    // A name the person typed is never replaced.
    fireEvent.change(within(form).getByLabelText("Name"), { target: { value: "Biscuit" } });
    fireEvent.click(within(group).getByRole("radio", { name: "Owl" }));
    expect(within(form).getByLabelText("Name")).toHaveValue("Biscuit");
  });

  it("goes back to Settings", () => {
    const onBack = vi.fn();
    render(<Crew onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: /Back to Settings/ }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
