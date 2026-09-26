/**
 * Tests for src/data/types.ts — semantic UI type constants.
 *
 * These are plain exported objects; tests verify shape and completeness.
 */
import { describe, it, expect } from "vitest";
import {
  STATUS_LABELS,
  SIGNAL_LABELS,
  SKELETON_AREAS,
  PERSONAL_AREAS,
  SKELETON_AREA_IDS,
  derivePersonalAreas,
  COMPANION_RESIDENTS,
  ASSISTANT_RESIDENT,
  companionResident,
  CAPABILITY_NAMES,
  capabilityDisplayName,
  plainAttention,
  toCapabilityStatus,
  journalKindLabel,
} from "../data/types";
import type { ServerSectionLike } from "../data/types";

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

  describe("SKELETON_AREAS — the stable skeleton (PRODUCT-LANGUAGE.md)", () => {
    it("is exactly the four contract landmarks, in the contract order", () => {
      expect(SKELETON_AREAS.map((a) => a.id)).toEqual([
        "overview",
        "memory",
        "chat",
        "settings",
      ]);
      // The home area keeps its id ("overview") but now wears the
      // Bridge label (owner plan 2026-09-25: the Bridge is home).
      expect(SKELETON_AREAS.map((a) => a.label)).toEqual([
        "Bridge",
        "Memory",
        "Chat",
        "Settings",
      ]);
    });

    it("names no retired area (today/news/records/journal are gone)", () => {
      const ids = SKELETON_AREAS.map((a) => a.id);
      for (const retired of ["today", "news", "records", "journal"]) {
        expect(ids).not.toContain(retired);
      }
    });

    it("carries no href — activation is state-driven, never a fake URL", () => {
      for (const area of [...SKELETON_AREAS, ...PERSONAL_AREAS]) {
        expect(area).not.toHaveProperty("href");
      }
    });
  });

  describe("PERSONAL_AREAS", () => {
    it("holds the person-shapable destinations and none of the landmarks", () => {
      const ids = PERSONAL_AREAS.map((a) => a.id);
      expect(ids).toEqual(["interests", "projects", "systems"]);
      for (const id of SKELETON_AREA_IDS) {
        expect(ids).not.toContain(id);
      }
    });

    it("uses the contract word for the attached machine (Computer, not Systems/Node)", () => {
      const systems = PERSONAL_AREAS.find((a) => a.id === "systems");
      expect(systems?.label).toBe("Computers");
      expect(systems?.label).not.toMatch(/node/i);
    });

    it("every area has a non-empty label", () => {
      for (const area of [...SKELETON_AREAS, ...PERSONAL_AREAS]) {
        expect(area.label).toBeTruthy();
      }
    });
  });

  describe("derivePersonalAreas — landmark stability (C3/Δ3) at the data layer", () => {
    const row = (
      id: string,
      order: number,
      visible = true,
    ): ServerSectionLike => ({ id, order, visible });

    it("falls back to the registry order when the server has said nothing", () => {
      expect(derivePersonalAreas(undefined).map((a) => a.id)).toEqual([
        "interests",
        "projects",
        "systems",
      ]);
      expect(derivePersonalAreas([]).map((a) => a.id)).toEqual([
        "interests",
        "projects",
        "systems",
      ]);
    });

    it("orders personal sections by the server layout", () => {
      const areas = derivePersonalAreas([
        row("projects", 0),
        row("interests", 1),
      ]);
      expect(areas.map((a) => a.id)).toEqual(["projects", "interests", "systems"]);
    });

    it("hides a personal section the server says is hidden", () => {
      const areas = derivePersonalAreas([
        row("interests", 0, true),
        row("projects", 1, false),
      ]);
      expect(areas.map((a) => a.id)).toEqual(["interests", "systems"]);
    });

    it("a server that hides and scrambles EVERYTHING still yields the untouched landmark set", () => {
      // The C3/Δ3 invariant at the data layer: whatever the layout
      // says, derivation only ever produces personal sections. The
      // four landmarks live in SKELETON_AREAS, which this function
      // cannot rewrite — App renders them unconditionally.
      const hostile: ServerSectionLike[] = [
        row("settings", 0, false),
        row("journal", 1, false),
        row("chat", 2, false),
        row("today", 3, false),
        row("interests", 4, false),
        row("projects", 5, false),
        row("systems", 6, false),
      ];
      const personal = derivePersonalAreas(hostile);
      for (const id of SKELETON_AREA_IDS) {
        expect(personal.map((a) => a.id)).not.toContain(id);
      }
      // Every hidden personal section simply drops away; the
      // landmark list is untouched by construction.
      expect(personal).toHaveLength(0);
      expect(SKELETON_AREAS.map((a) => a.id)).toEqual([
        "overview",
        "memory",
        "chat",
        "settings",
      ]);
    });

    it("server rows for skeleton-era ids (today/journal) cannot enter personal nav", () => {
      const areas = derivePersonalAreas([row("today", 0), row("journal", 1)]);
      const ids = areas.map((a) => a.id);
      expect(ids).not.toContain("today");
      expect(ids).not.toContain("journal");
      // …and no known destination is ever silently lost:
      expect(ids).toEqual(["interests", "projects", "systems"]);
    });

    it("skips server ids the UI has no destination for without dropping known ones", () => {
      const areas = derivePersonalAreas([
        row("media", 0),
        row("interests", 1),
        row("lab", 2),
        row("vault", 3),
      ]);
      expect(areas.map((a) => a.id)).toEqual(["interests", "projects", "systems"]);
    });

    it("deduplicates repeated server rows", () => {
      const areas = derivePersonalAreas([row("interests", 0), row("interests", 1)]);
      expect(areas.filter((a) => a.id === "interests")).toHaveLength(1);
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
    it("covers every server companion value except voiceless Sol", () => {
      // src/personal_world/prefs.py COMPANION.allowed, minus
      // `personal-world` (Sol, the Worlds mark, has no voice).
      expect(Object.keys(COMPANION_RESIDENTS).sort()).toEqual([
        "assistant",
        "mermaid",
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
      expect(COMPANION_RESIDENTS["taco-news-truck"].name).toBe("Scoop");
      expect(COMPANION_RESIDENTS["assistant"].name).toBe("Assistant");
      expect(COMPANION_RESIDENTS["personal-world"]).toBeUndefined();
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

  describe("plainAttention — the attention cards' plain language", () => {
    it("translates a known capability + status, keeping the wire string reachable", () => {
      expect(plainAttention("source_control: needs_attention")).toEqual({
        headline: "Source control needs your attention.",
        technical: "source_control: needs_attention",
      });
    });

    it("agrees with plural capability names — never 'Notifications is'", () => {
      expect(plainAttention("notifications: unavailable").headline).toBe(
        "Notifications are unavailable.",
      );
      expect(plainAttention("secrets: not_configured").headline).toBe(
        "Secrets are not set up yet.",
      );
      expect(plainAttention("scheduler: needs_attention").headline).toBe(
        "Scheduled tasks need your attention.",
      );
      // singular names keep singular grammar
      expect(plainAttention("calendar: unavailable").headline).toBe(
        "Calendar is unavailable.",
      );
    });

    it("states the honest fact for the optional assistant", () => {
      const plain = plainAttention("reasoning: unavailable");
      expect(plain.headline).toBe("The assistant is off — nothing depends on it.");
      expect(plain.technical).toBe("reasoning: unavailable");
    });

    it("carries an em-dash note through the translation", () => {
      expect(
        plainAttention(
          "source_control: needs_attention — reply to the digest proposal",
        ).headline,
      ).toBe(
        "Source control needs your attention — reply to the digest proposal.",
      );
    });

    it("degrades an unknown id to a readable sentence, never a bare snake_case token", () => {
      const plain = plainAttention("vault_backup: stale");
      expect(plain.headline).toBe("The latest word from Vault Backup is out of date.");
      expect(plain.headline).not.toMatch(/[a-z]_[a-z]/);
    });

    it("keeps the station's own words for free-text tails, humanizing only the id", () => {
      expect(plainAttention("journal: stale digest")).toEqual({
        headline: "Journal: stale digest",
        technical: "journal: stale digest",
      });
    });

    it("passes through prose that carries no id at all", () => {
      expect(plainAttention("the loop found nothing to say")).toEqual({
        headline: "the loop found nothing to say",
      });
    });

    it("renders no bare status token for any known capability × degraded status", () => {
      const statuses = [
        "needs_attention", "warning", "unavailable", "stale",
        "unknown", "disabled", "not_configured",
      ];
      for (const id of Object.keys(CAPABILITY_NAMES)) {
        for (const status of statuses) {
          const { headline } = plainAttention(`${id}: ${status}`);
          expect(headline.length).toBeGreaterThan(0);
          expect(headline).not.toMatch(/[a-z]_[a-z]/);
        }
      }
    });
  });

  describe("capabilityDisplayName", () => {
    it("names curated ids with their human words", () => {
      expect(capabilityDisplayName("source_control")).toBe("Source control");
      expect(capabilityDisplayName("reasoning")).toBe("The assistant");
    });

    it("humanizes an unknown id instead of leaking the token", () => {
      expect(capabilityDisplayName("foo_bar")).toBe("Foo Bar");
    });
  });
});

describe("companionResident — the face follows the voice", () => {
  const crew = [
    { id: "renai", name: "Renai", source: "starter" as const, hidden: false, portrait_asset: "/assets/crew/512/renai-hello.webp" },
    { id: "pip", name: "Pip", source: "user" as const, hidden: false, portrait_asset: null },
    { id: "bolt", name: "Bolt", source: "starter" as const, hidden: true },
  ];

  it("shows nobody when the personality pack is off", () => {
    expect(companionResident({ companion_id: "renai", personality_pack: "off" }, crew)).toBeUndefined();
  });

  it("shows the Assistant for no companion, an unknown one, or a hidden one", () => {
    for (const id of [null, "ghost", "bolt"]) {
      expect(companionResident({ companion_id: id, personality_pack: "residents" }, crew)).toEqual(
        ASSISTANT_RESIDENT,
      );
    }
  });

  it("names a crew companion with their own picture", () => {
    const r = companionResident({ companion_id: "renai", personality_pack: "residents" }, crew);
    expect(r?.name).toBe("Renai");
    expect(r?.artwork).toMatch(/assets\/crew\/512\/renai-hello\.webp$/);
    expect(companionResident({ companion_id: "pip", personality_pack: "residents" }, crew)?.artwork).toBeUndefined();
  });

  it("reads the old key through the server's canon mapping when companion_id is absent", () => {
    expect(companionResident({ companion: "mermaid", personality_pack: "residents" }, crew)?.name).toBe("Renai");
    expect(companionResident({ companion: "personal-world", personality_pack: "residents" }, crew)).toEqual(
      ASSISTANT_RESIDENT,
    );
    // Crew not loaded yet: a known legacy face still shows.
    expect(companionResident({ companion: "robot", personality_pack: "residents" }, undefined)?.name).toBe("Bolt");
  });
});
