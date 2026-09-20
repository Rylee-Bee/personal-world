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
  COMPANION_RESIDENTS,
  toCapabilityStatus,
  journalKindLabel,
} from "../data/types";

describe("types constants", () => {
  describe("STATUS_LABELS", () => {
    it("has all 8 capability statuses (server Status vocabulary)", () => {
      const expected = [
        "healthy",
        "warning",
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

  describe("toCapabilityStatus", () => {
    it("passes the server vocabulary through unchanged", () => {
      for (const s of Object.keys(STATUS_LABELS)) {
        expect(toCapabilityStatus(s)).toBe(s);
      }
    });

    it("degrades unknown values to 'unknown' (never casts fiction)", () => {
      expect(toCapabilityStatus("on_fire")).toBe("unknown");
      expect(toCapabilityStatus("")).toBe("unknown");
    });
  });

  describe("COMPANION_RESIDENTS", () => {
    it("covers every server companion preference value", () => {
      // src/personal_world/prefs.py COMPANION.allowed
      expect(Object.keys(COMPANION_RESIDENTS).sort()).toEqual([
        "mermaid",
        "personal-world",
        "robot",
        "taco-news-truck",
        "world-tree-squirrel",
      ]);
    });

    it("gives each resident an id, name and role", () => {
      for (const resident of Object.values(COMPANION_RESIDENTS)) {
        expect(resident.id).toBeTruthy();
        expect(resident.name).toBeTruthy();
        expect(resident.role).toBeTruthy();
      }
    });

    it("maps companion keys to their canon display names", () => {
      // docs/COMPANION-CANON.md
      expect(COMPANION_RESIDENTS["mermaid"].name).toBe("Renai");
      expect(COMPANION_RESIDENTS["robot"].name).toBe("Bolt");
      expect(COMPANION_RESIDENTS["world-tree-squirrel"].name).toBe("Ratatoskr");
      expect(COMPANION_RESIDENTS["taco-news-truck"].name).toBe("Burrito Journalism");
      expect(COMPANION_RESIDENTS["personal-world"].name).toBe("Personal World");
    });
  });

  describe("journalKindLabel", () => {
    it("labels every server JournalKind", () => {
      const kinds = [
        "observation", "health", "drift", "recommendation", "approval",
        "reconciliation", "provider_action", "failure", "pack_change",
        "settings_change", "security", "discovery",
      ];
      for (const kind of kinds) {
        expect(journalKindLabel(kind)).toBeTruthy();
        expect(journalKindLabel(kind)).not.toBe("Journal entry");
      }
    });

    it("degrades an unseen kind to a quiet generic label", () => {
      expect(journalKindLabel("alien_kind")).toBe("Journal entry");
    });
  });
});
