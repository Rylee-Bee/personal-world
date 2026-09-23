/**
 * One voice + tone registers (TRUE-NORTH § Voice, W1-B) — client side.
 *
 * The registers are a closed server vocabulary (prefs.py TONE):
 * an unknown value degrades to the warm default, never a guess; the
 * warm register is byte-identical to the historical SIGNAL_LABELS so
 * the default rendering never shifts; every register labels every
 * urgency level in words (§1.3), and `critical` always says plainly
 * that attention is needed — a tone may rephrase a label, never
 * remove or soften it.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  activeToneRegister,
  chatToneCopy,
  DEFAULT_TONE,
  parseTone,
  TONE_REGISTERS,
  toneSignalLabels,
} from "../language/tone";
import { SIGNAL_LABELS, type WorldSignalLevel } from "../data/types";
import { WorldSignal } from "../components/WorldSignal";
import {
  parsePrefsSchema,
  prefKeyLabel,
  prefValueLabel,
} from "../screens/Settings/parse";

const LEVELS: WorldSignalLevel[] = ["good", "update", "waiting", "critical"];

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-pw-tone");
});

describe("parseTone", () => {
  it("passes every server-legal register through", () => {
    for (const tone of TONE_REGISTERS) {
      expect(parseTone(tone)).toBe(tone);
    }
  });

  it("degrades unknown, absent, or non-string values to the warm default", () => {
    expect(parseTone("sarcastic")).toBe(DEFAULT_TONE);
    expect(parseTone(undefined)).toBe(DEFAULT_TONE);
    expect(parseTone(null)).toBe(DEFAULT_TONE);
    expect(parseTone(3)).toBe(DEFAULT_TONE);
    expect(parseTone("WARM")).toBe(DEFAULT_TONE);
  });
});

describe("toneSignalLabels — attention voices in the active tone", () => {
  it("warm is byte-identical to the historical SIGNAL_LABELS", () => {
    expect(toneSignalLabels("warm")).toBe(SIGNAL_LABELS);
  });

  it("every register labels every level with real words", () => {
    for (const tone of TONE_REGISTERS) {
      const labels = toneSignalLabels(tone);
      for (const level of LEVELS) {
        expect(labels[level], `${tone}/${level}`).toBeTruthy();
        expect(labels[level].length).toBeGreaterThan(0);
      }
    }
  });

  it("no register softens critical into calm", () => {
    // Honesty floor: the critical label always names attention/action
    // in the active tone — never a neutral word like "Update".
    for (const tone of TONE_REGISTERS) {
      expect(toneSignalLabels(tone).critical.toLowerCase()).toMatch(
        /attention|action|needs you/,
      );
    }
  });

  it("an unknown register falls back to the warm labels", () => {
    expect(
      toneSignalLabels("bogus" as (typeof TONE_REGISTERS)[number]),
    ).toBe(SIGNAL_LABELS);
  });
});

describe("activeToneRegister — the document's applied tone", () => {
  it("is warm when no pref has landed yet", () => {
    expect(activeToneRegister()).toBe("warm");
  });

  it("reads the data-pw-tone attribute prefs-dom writes", () => {
    document.documentElement.setAttribute("data-pw-tone", "formal");
    expect(activeToneRegister()).toBe("formal");
  });

  it("degrades an unrecognised attribute to warm, never a guess", () => {
    document.documentElement.setAttribute("data-pw-tone", "haughty");
    expect(activeToneRegister()).toBe("warm");
  });
});

describe("WorldSignal speaks the active tone", () => {
  it("labels the level in warm by default (unchanged rendering)", () => {
    render(<WorldSignal level="update" title="Found 3 new items." />);
    expect(screen.getByText("A small update:")).toBeInTheDocument();
  });

  it("labels the level in the document's register", () => {
    document.documentElement.setAttribute("data-pw-tone", "concise");
    render(<WorldSignal level="update" title="Found 3 new items." />);
    expect(screen.getByText("Update:")).toBeInTheDocument();
  });

  it("an explicit tone prop wins over the document", () => {
    document.documentElement.setAttribute("data-pw-tone", "concise");
    render(<WorldSignal level="good" title="All healthy." tone="formal" />);
    expect(screen.getByText("Positive status:")).toBeInTheDocument();
  });

  it("keeps the headline and the technical disclosure untouched by tone", () => {
    document.documentElement.setAttribute("data-pw-tone", "playful");
    render(
      <WorldSignal
        level="critical"
        title="Vault unavailable"
        technical="vault: unavailable"
      />,
    );
    expect(screen.getByText("Vault unavailable")).toBeInTheDocument();
    expect(screen.getByText("This one needs you:")).toBeInTheDocument();
    expect(screen.queryByText("vault: unavailable")).not.toBeVisible();
  });
});

describe("chatToneCopy — honest-off labeling in every register", () => {
  it("gives every register real copy", () => {
    for (const tone of TONE_REGISTERS) {
      const copy = chatToneCopy(tone);
      expect(copy.empty).toBeTruthy();
      expect(copy.thinking).toBeTruthy();
      expect(copy.unavailableHeading).toBeTruthy();
    }
  });

  it("every register LABELS the degraded state, none softens it", () => {
    for (const tone of TONE_REGISTERS) {
      expect(chatToneCopy(tone).unavailableHeading.toLowerCase()).toMatch(
        /unavailable|not available|can't answer/,
      );
    }
  });

  it("an unknown register falls back to the warm copy", () => {
    expect(chatToneCopy("bogus" as (typeof TONE_REGISTERS)[number])).toEqual(
      chatToneCopy("warm"),
    );
  });
});

describe("Settings vocabulary for the voice prefs", () => {
  const toneEntry = {
    key: "tone",
    type: "enum" as const,
    default: "warm",
    floor: "warm",
    allowed: ["warm", "concise", "playful", "formal"],
    integer: false,
    unit: "",
  };
  const packEntry = {
    key: "personality_pack",
    type: "enum" as const,
    default: "off",
    floor: "off",
    allowed: ["off", "residents"],
    integer: false,
    unit: "",
  };

  it("names the keys in product language", () => {
    expect(prefKeyLabel("tone")).toBe("Voice tone");
    expect(prefKeyLabel("personality_pack")).toBe("Personality pack");
  });

  it("labels every value in words, the default named as such", () => {
    expect(prefValueLabel(toneEntry, "warm")).toBe("Warm (default)");
    expect(prefValueLabel(toneEntry, "concise")).toBe("Concise");
    expect(prefValueLabel(toneEntry, "playful")).toBe("Playful");
    expect(prefValueLabel(toneEntry, "formal")).toBe("Formal");
    expect(prefValueLabel(packEntry, "off")).toBe("Off (the one voice)");
    expect(prefValueLabel(packEntry, "residents")).toBe(
      "Residents (optional character pack)",
    );
  });

  it("parses the server's voice schema entries like any other enum", () => {
    const parsed = parsePrefsSchema({
      ok: true,
      data: {
        tone: {
          type: "enum", default: "warm", floor: "warm",
          allowed: ["warm", "concise", "playful", "formal"],
        },
        personality_pack: {
          type: "enum", default: "off", floor: "off",
          allowed: ["off", "residents"],
        },
      },
    });
    expect(parsed.entries.map((e) => e.key)).toEqual([
      "personality_pack",
      "tone",
    ]);
    expect(parsed.rejectedKeys).toEqual([]);
  });
});
