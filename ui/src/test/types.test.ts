/**
 * Tests for src/data/types.ts — semantic UI type constants.
 *
 * These are plain exported objects; tests verify shape and completeness.
 */
import { describe, it, expect } from "vitest";
import {
  STATUS_LABELS,
  SIGNAL_LABELS,
  WORLD_AREAS,
} from "../data/types";

describe("types constants", () => {
  describe("STATUS_LABELS", () => {
    it("has all 7 capability statuses", () => {
      const expected = [
        "healthy",
        "needs_attention",
        "unavailable",
        "stale",
        "unknown",
        "disabled",
        "not_configured",
      ];

      expect(Object.keys(STATUS_LABELS)).toEqual(expected);
    });

    it("maps each status to a non-empty human label", () => {
      for (const [key, label] of Object.entries(STATUS_LABELS)) {
        expect(label).toBeTruthy();
        expect(typeof label).toBe("string");
        expect(label.length).toBeGreaterThan(0);
        // Keys are lowercase with underscores
        expect(key).toMatch(/^[a-z_]+$/);
      }
    });
  });

  describe("SIGNAL_LABELS", () => {
    it("has all 4 signal levels", () => {
      const expected = ["good", "update", "waiting", "critical"];

      expect(Object.keys(SIGNAL_LABELS)).toEqual(expected);
    });

    it("maps each level to a non-empty human label", () => {
      for (const [, label] of Object.entries(SIGNAL_LABELS)) {
        expect(label).toBeTruthy();
        expect(typeof label).toBe("string");
      }
    });
  });

  describe("WORLD_AREAS", () => {
    it("has all 8 expected areas", () => {
      expect(WORLD_AREAS).toHaveLength(8);
    });

    it("has unique ids", () => {
      const ids = WORLD_AREAS.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("matches expected ids in order", () => {
      const ids = WORLD_AREAS.map((a) => a.id);
      expect(ids).toEqual([
        "today",
        "systems",
        "projects",
        "journal",
        "news",
        "interests",
        "records",
        "settings",
      ]);
    });

    it("every area has label and href", () => {
      for (const area of WORLD_AREAS) {
        expect(area.label).toBeTruthy();
        expect(area.href).toBeTruthy();
        expect(area.href.startsWith("/")).toBe(true);
      }
    });
  });
});
