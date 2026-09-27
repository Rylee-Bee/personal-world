import { describe, it, expect } from "vitest";
import { newestFirst } from "../screens/Memory/journalOrder";

describe("Journal list order", () => {
  it("shows the newest entry first, whatever order the API sends", () => {
    const api = [
      { ts: "2026-09-27T05:58:42Z", summary: "old" },
      { ts: "2026-09-27T09:00:00Z", summary: "middle" },
      { ts: "2026-09-27T11:10:40Z", summary: "just written" },
    ];
    expect(newestFirst(api).map((e) => e.summary)).toEqual(["just written", "middle", "old"]);
    expect(api[0].summary).toBe("old"); // the input isn't mutated
  });
});
