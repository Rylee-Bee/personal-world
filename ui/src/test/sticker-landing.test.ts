/** When a sticker stays quiet: quiet hours (past midnight too), and 12 hours after a rough night. */
import { describe, it, expect, afterEach } from "vitest";
import { inQuietHours, noteRoughNight } from "../components/stickers/landing";

const at = (h: number, m = 0) => new Date(2026, 8, 27, h, m);

afterEach(() => window.localStorage.clear());

describe("quiet hours", () => {
  it("defaults to 21:00–08:00 and runs past midnight", () => {
    expect(inQuietHours(undefined, at(22))).toBe(true);
    expect(inQuietHours(undefined, at(3))).toBe(true);
    expect(inQuietHours(undefined, at(8))).toBe(false);
    expect(inQuietHours(undefined, at(14))).toBe(false);
  });
  it("follows the person's own hours, and off means never quiet", () => {
    expect(inQuietHours({ on: true, start: "13:00", end: "15:00" }, at(14))).toBe(true);
    expect(inQuietHours({ on: true, start: "13:00", end: "15:00" }, at(16))).toBe(false);
    expect(inQuietHours({ on: false, start: "21:00", end: "08:00" }, at(23))).toBe(false);
  });
});

describe("after a rough night", () => {
  it("remembers when Rough night was opened", () => {
    noteRoughNight(1000);
    expect(window.localStorage.getItem("pw-rough-night-at")).toBe("1000");
  });
});
