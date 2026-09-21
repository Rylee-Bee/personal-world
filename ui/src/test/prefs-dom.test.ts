/**
 * Tests for prefs-dom (C12) — the applied side of the Settings Room.
 *
 * The contract under test is NAME-parity with the server: src/
 * personal_world/prefs.py declares one data-* attribute and one --pw-*
 * custom property per preference, formats numbers `:g`-style, clamps
 * target_size to the 44px floor, and defines the motion tiers. This
 * file asserts the SPA writes exactly that vocabulary onto <html> —
 * the same names the server-rendered dashboard already consumes.
 * (Computed style effects live in world.css and are proven in the
 * Playwright specs, where real CSS applies.)
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  applyPrefsToDocument,
  applyThemeToDocument,
  isThemeName,
  readStoredTheme,
  saveStoredTheme,
} from "../app/prefs-dom";

const DOM_KEYS = [
  "data-pw-motion",
  "data-pw-contrast",
  "data-pw-text-scale",
  "data-pw-density",
  "data-pw-target-size",
  "data-pw-companion",
  "data-pw-accent",
] as const;

const DOM_VARS = [
  "--pw-motion",
  "--pw-contrast",
  "--pw-text-scale",
  "--pw-density",
  "--pw-target-size",
  "--pw-companion",
  "--pw-accent",
  "--pw-motion-duration",
  "--pw-motion-ambient",
] as const;

afterEach(() => {
  const root = document.documentElement;
  for (const attr of [...DOM_KEYS, "data-theme"]) root.removeAttribute(attr);
  for (const name of DOM_VARS) root.style.removeProperty(name);
  window.localStorage.clear();
});

describe("applyPrefsToDocument", () => {
  it("writes prefs.py's data-attr + css-var pair for every server key", () => {
    applyPrefsToDocument(
      {
        motion: "reduced",
        contrast: "comfortable",
        text_scale: 1,
        density: "comfortable",
        target_size: 44,
        companion: "mermaid",
        accent: "world-keeper",
      },
      { reduceMotion: false },
    );
    const root = document.documentElement;
    for (const [key, value] of Object.entries({
      "data-pw-motion": "reduced",
      "data-pw-contrast": "comfortable",
      "data-pw-text-scale": "1", // `:g` — 1.0 renders as "1"
      "data-pw-density": "comfortable",
      "data-pw-target-size": "44",
      "data-pw-companion": "mermaid",
      "data-pw-accent": "world-keeper",
    })) {
      expect(root.getAttribute(key), key).toBe(value);
    }
    expect(root.style.getPropertyValue("--pw-motion")).toBe("reduced");
    expect(root.style.getPropertyValue("--pw-text-scale")).toBe("1");
    expect(root.style.getPropertyValue("--pw-target-size")).toBe("44px");
    // The reduced tier: no ambient motion, no transition time.
    expect(root.style.getPropertyValue("--pw-motion-duration")).toBe("0ms");
    expect(root.style.getPropertyValue("--pw-motion-ambient")).toBe("0");
  });

  it("keeps the units and the 44px floor on the CSS side (prefs_to_css_variables)", () => {
    applyPrefsToDocument({ target_size: 56, text_scale: 1.25, motion: "off" }, { reduceMotion: false });
    const root = document.documentElement;
    expect(root.getAttribute("data-pw-target-size")).toBe("56");
    expect(root.style.getPropertyValue("--pw-target-size")).toBe("56px");
    expect(root.style.getPropertyValue("--pw-text-scale")).toBe("1.25");
    expect(root.style.getPropertyValue("--pw-motion-duration")).toBe("0ms");
  });

  it("clamps a below-floor target size upward, never down (§9.2: compact can never shrink hit areas)", () => {
    // Defensive: the server validates, but the DOM floor must hold even
    // against a value that somehow arrived — same max() the server's
    // prefs_to_css_variables applies.
    applyPrefsToDocument({ target_size: 40, motion: "reduced" }, { reduceMotion: false });
    expect(document.documentElement.style.getPropertyValue("--pw-target-size")).toBe(
      "44px",
    );
  });

  it("ignores keys the prefs.py table does not describe — server data never names arbitrary attributes", () => {
    applyPrefsToDocument(
      { motion: "subtle", onclick: "alert(1)", style: "position:fixed", theme: "moss" },
      { reduceMotion: false },
    );
    const root = document.documentElement;
    expect(root.getAttribute("data-pw-motion")).toBe("subtle");
    expect(root.hasAttribute("onclick")).toBe(false);
    expect(root.getAttribute("style")).not.toMatch(/position/);
    // "theme" is not a prefs key — it must not become data-pw-theme or
    // data-theme through this path.
    expect(root.getAttribute("data-pw-theme")).toBeNull();
    expect(root.getAttribute("data-theme")).toBeNull();
  });

  it("the subtle tier gets its 200ms window only when the OS allows motion", () => {
    applyPrefsToDocument({ motion: "subtle" }, { reduceMotion: false });
    expect(document.documentElement.style.getPropertyValue("--pw-motion-duration")).toBe(
      "200ms",
    );
    expect(document.documentElement.style.getPropertyValue("--pw-motion-ambient")).toBe("1");
  });

  it("STAFF MEETING #4-2 FIREWALL: an explicit 'subtle' pref cannot force motion over the OS reduce floor — the attribute stays honest, the tokens go motionless", () => {
    applyPrefsToDocument({ motion: "subtle" }, { reduceMotion: true });
    const root = document.documentElement;
    // Server truth is never rewritten: the attribute reports what the
    // station stores…
    expect(root.getAttribute("data-pw-motion")).toBe("subtle");
    // …while the motion budget is clamped to the motionless tier, so an
    // explicit pref can only ever REDUCE. (world.css carries the same
    // clamp as its last rule for pure-CSS consumers.)
    expect(root.style.getPropertyValue("--pw-motion-duration")).toBe("0ms");
    expect(root.style.getPropertyValue("--pw-motion-ambient")).toBe("0");
  });
});

describe("theme (device-local — no server key exists)", () => {
  it("applies data-theme for real overrides and removes it for the Station default", () => {
    applyThemeToDocument("starfield");
    expect(document.documentElement.getAttribute("data-theme")).toBe("starfield");
    applyThemeToDocument("station");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("remembers this device's choice under the old chrome's storage key", () => {
    saveStoredTheme("moss");
    expect(window.localStorage.getItem("pw-station-theme")).toBe("moss");
    expect(readStoredTheme()).toBe("moss");
  });

  it("an unrecognised stored theme reads as null — never applied", () => {
    window.localStorage.setItem("pw-station-theme", "not-a-theme");
    expect(readStoredTheme()).toBeNull();
    expect(isThemeName("not-a-theme")).toBe(false);
    expect(isThemeName("ocean")).toBe(true);
  });
});
