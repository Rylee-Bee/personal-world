import { describe, expect, it } from "vitest";
import { briefing, buildSections } from "../fd/home-model";
import { cards, homeBoard } from "../fd/fixtures";

describe("home model", () => {
  const s = buildSections(homeBoard, cards);
  const ids = (rows: { item: { card: string } }[]) => rows.map((r) => r.item.card);

  it("puts each fixture in one section", () => {
    expect(ids(s.needs_you)).toEqual(["inbox"]);
    expect(ids(s.needs_look)).toEqual(["downloads", "backup"]);
    expect(ids(s.your_life)).toEqual(["weather", "reading", "later", "music", "malformed"]);
    expect(ids(s.quietly_working)).toEqual(["disk", "checks"]);
  });
  it("skips hidden items and items with no card", () => {
    const b = { ...homeBoard, items: homeBoard.items.map((i) => (i.card === "disk" ? { ...i, hidden: true } : i)) };
    expect(ids(buildSections(b, cards).quietly_working)).toEqual(["checks"]);
    expect(buildSections(b, {}).your_life).toEqual([]);
  });
  it("orders Needs a look worst first", () => {
    const b = { ...homeBoard, items: [homeBoard.items.find((i) => i.card === "backup")!, homeBoard.items.find((i) => i.card === "downloads")!] };
    expect(ids(buildSections(b, cards).needs_look)).toEqual(["downloads", "backup"]);
  });
  it("writes a terse briefing", () => {
    expect(briefing(s)).toBe("1 for you · Downloads down · Backup stale · rest quiet");
    expect(briefing({ needs_you: [], needs_look: [], your_life: [], quietly_working: [] })).toBe("all quiet");
  });
});
