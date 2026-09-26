import { describe, expect, it } from "vitest";
import { hasRecommendation, needChoices, offerLabel, roomOffers } from "../components/rooms/choices";
import type { RoomNeed, RoomRow } from "../data/contract";

const need = (over: Partial<RoomNeed>): RoomNeed => ({
  id: "n1",
  title: "Which label?",
  why: "",
  actions: ["answer-decision"],
  created_at: "2026-09-26T10:00:00Z",
  ...over,
});

describe("needChoices", () => {
  it("keeps strings only, trimmed, without blanks or repeats, at most six", () => {
    const choices = need({ choices: [" Yes ", "", "Yes", 3 as unknown as string, "No", "a", "b", "c", "d", "e"] }).choices;
    expect(needChoices(need({ choices }))).toEqual(["Yes", "No", "a", "b", "c", "d"]);
  });
  it("is empty when the need has no choices", () => {
    expect(needChoices(need({}))).toEqual([]);
    expect(needChoices(need({ choices: "Yes" as unknown as string[] }))).toEqual([]);
  });
});

describe("hasRecommendation", () => {
  it("is true only when why starts with Recommended:", () => {
    expect(hasRecommendation(need({ why: "Recommended: Doing." }))).toBe(true);
    expect(hasRecommendation(need({ why: "  recommended : x" }))).toBe(true);
    expect(hasRecommendation(need({ why: "Not recommended: x" }))).toBe(false);
  });
});

describe("roomOffers", () => {
  const row = {
    actions: [
      { id: "answer-decision", writes: true },
      { id: "approve" },
      { id: "run-freshness", title: "Re-check the tickets", writes: false },
      { id: "rebuild-board" },
      { id: "  " },
    ],
  } as unknown as RoomRow;

  it("never offers need-bound actions, and fails closed on writes", () => {
    expect(roomOffers(row, false).map((a) => a.id)).toEqual(["run-freshness"]);
    expect(roomOffers(row, true).map((a) => a.id)).toEqual(["run-freshness", "rebuild-board"]);
  });
  it("offers nothing when the row lists no actions", () => {
    expect(roomOffers({} as RoomRow, true)).toEqual([]);
  });
  it("labels an action by its title, else its id in words", () => {
    expect(offerLabel({ id: "run-freshness", title: "Re-check the tickets" })).toBe("Re-check the tickets");
    expect(offerLabel({ id: "rebuild-board" })).toBe("Rebuild board");
  });
});

describe("Hive Works art", () => {
  it("has its own drawn doorway", async () => {
    const { drawnInteriorUrl } = await import("../components/rooms/crew");
    expect(drawnInteriorUrl("hive-works")).toMatch(/assets\/crew\/512\/hive-works-doorway\.webp$/);
    expect(drawnInteriorUrl("Hive Works")).toMatch(/hive-works-doorway\.webp$/);
  });
});
