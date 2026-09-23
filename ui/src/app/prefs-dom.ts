/**
 * prefs-dom — the applied side of the Settings Room.
 *
 * C12 closes the gap C11 named: the old station.js chrome applied
 * presentation prefs on every page; this rebuild rendered the values
 * but never mutated the surface. This module is the single place
 * server-truth prefs enter the document.
 *
 * The attribute and custom-property names are NOT invented here: they
 * are `prefs.py`'s own per-pref `data_attr` / `css_var` declarations
 * (src/personal_world/prefs.py PREFS), the number formatting mirrors
 * `prefs_to_data_attributes` (`:g` — no trailing zeros, no unit) and
 * `prefs_to_css_variables` (unit suffix, target_size clamped to the
 * 44px accessibility floor), and the motion tiers mirror
 * `MOTION_TIERS` / `prefs_style_block`. The world.css prefs layer
 * consumes exactly what is written here, the same way the
 * server-rendered dashboard consumes `prefs_style_block()`.
 *
 * Accessibility firewall (Staff Meeting #4 item 2): an explicit user
 * motion pref can only REDUCE motion relative to what the OS floor
 * allows — never force motion over `prefers-reduced-motion: reduce`.
 * That is enforced twice: here (`reduceMotion` clamps the duration
 * tokens to the motionless tier) and in world.css, whose
 * prefers-reduced-motion override is the LAST rule of the prefs
 * layer. The data-pw-motion attribute always stays honest to the
 * server value; only the motion effect is clamped.
 *
 * Theme is the one presentation choice with no server key: the
 * station serves theme packs (GET /api/themes) but has no theme-write
 * endpoint, so the chosen theme persists on the DEVICE — the same
 * localStorage mechanism the old station.js chrome used
 * ("pw-station-theme"), and Settings' Theme section says so plainly.
 */

import { THEMES, type ThemeName } from "../generated/tokens";

/** Schema-validated pref values (see screens/Settings/parse.ts — the
 *  only callers pass values already read through `readPrefsValues`). */
export type DomPrefsValue = string | number;

interface PrefDomSpec {
  /** data-* attribute on <html> — prefs.py `data_attr`. */
  attr: string;
  /** CSS custom property on <html> — prefs.py `css_var`. */
  cssVar: string;
  /** Number formatting unit suffix — prefs.py `unit`. */
  unit: string;
}

/** One row per prefs.py EnumPref/NumberPref. A key the server does not
 *  describe must never reach the DOM through this table — so the table
 *  is the allowlist: unknown keys are dropped, silently but honestly
 *  (there is no vocabulary for them yet). */
const PREF_DOM_SPECS: Record<string, PrefDomSpec> = {
  motion: { attr: "data-pw-motion", cssVar: "--pw-motion", unit: "" },
  contrast: { attr: "data-pw-contrast", cssVar: "--pw-contrast", unit: "" },
  text_scale: { attr: "data-pw-text-scale", cssVar: "--pw-text-scale", unit: "" },
  density: { attr: "data-pw-density", cssVar: "--pw-density", unit: "" },
  target_size: { attr: "data-pw-target-size", cssVar: "--pw-target-size", unit: "px" },
  companion: { attr: "data-pw-companion", cssVar: "--pw-companion", unit: "" },
  accent: { attr: "data-pw-accent", cssVar: "--pw-accent", unit: "" },
  // Voice prefs (TRUE-NORTH § Voice): phrasing registers on <html> so
  // tone-aware copy (language/tone.ts activeToneRegister) reads the
  // same server truth the CSS layer does. Comfort, never accessibility
  // — no value here may lower any floor.
  tone: { attr: "data-pw-tone", cssVar: "--pw-tone", unit: "" },
  personality_pack: {
    attr: "data-pw-personality-pack",
    cssVar: "--pw-personality-pack",
    unit: "",
  },
};

/** prefs.py MOTION_TIERS, verbatim. */
const MOTION_TIERS: Record<string, { duration: string; ambient: string }> = {
  off: { duration: "0ms", ambient: "0" },
  reduced: { duration: "0ms", ambient: "0" },
  subtle: { duration: "200ms", ambient: "1" },
};

/** prefs.py TARGET_SIZE_FLOOR — compact density and any stray value can
 *  never shrink a hit target below 44px (prefs_to_css_variables clamps
 *  with max(), mirrored here). */
const TARGET_SIZE_FLOOR = 44;

/** Python `f"{value:g}"` for this vocabulary's numbers: no trailing
 *  zeros (1.0 → "1"), no exponent — plain number stringification does
 *  exactly that for every value the schema allows. */
function formatNumber(value: number): string {
  return String(value);
}

function setVar(root: HTMLElement, name: string, value: string): void {
  root.style.setProperty(name, value);
}

function setAttr(root: HTMLElement, name: string, value: string): void {
  root.setAttribute(name, value);
}

export interface ApplyPrefsOptions {
  /** OS prefers-reduced-motion floor. When true, motion tokens are
   *  clamped to the motionless tier no matter what the user picked —
   *  the pref can only reduce. Defaults to the live media query. */
  reduceMotion?: boolean;
}

/** Apply server-truth preference values to <html>. Values must already
 *  be schema-narrowed (readPrefsValues); anything not in the prefs.py
 *  table is ignored rather than trusted. */
export function applyPrefsToDocument(
  values: Readonly<Record<string, DomPrefsValue>>,
  options?: ApplyPrefsOptions,
): void {
  const root = document.documentElement;
  const reduceMotion =
    options?.reduceMotion ?? osPrefersReducedMotion();

  for (const [key, spec] of Object.entries(PREF_DOM_SPECS)) {
    const value = values[key];
    if (value === undefined) continue;

    if (typeof value === "number") {
      // prefs_to_data_attributes: bare `:g` number, no unit.
      setAttr(root, spec.attr, formatNumber(value));
      // prefs_to_css_variables: unit-suffixed, target_size floor-clamped.
      const cssValue =
        key === "target_size"
          ? `${Math.max(value, TARGET_SIZE_FLOOR)}${spec.unit}`
          : `${formatNumber(value)}${spec.unit}`;
      setVar(root, spec.cssVar, cssValue);
    } else {
      setAttr(root, spec.attr, value);
      setVar(root, spec.cssVar, value);
    }
  }

  // Motion tier tokens. The attribute above already carries the raw
  // server value (world.css tier rules key off it); the duration and
  // ambient tokens are clamped by the OS floor — an explicit "subtle"
  // NEVER buys motion back over prefers-reduced-motion: reduce.
  const motion = values["motion"];
  const tier = typeof motion === "string" ? MOTION_TIERS[motion] : undefined;
  if (tier) {
    const clamped = reduceMotion && motion === "subtle";
    setVar(root, "--pw-motion-duration", clamped ? "0ms" : tier.duration);
    setVar(root, "--pw-motion-ambient", clamped ? "0" : tier.ambient);
  }
}

/** Live read of the OS floor; absent matchMedia (SSR-ish) means the
 *  floor is unknown, and unknown resolves to the accessible default
 *  (no motion). */
export function osPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ─── Theme (device-local — no server write endpoint exists) ──────────

/** The old station.js chrome's key; kept for continuity. */
const THEME_STORAGE_KEY = "pw-station-theme";

/** L2 → D2 (owner decision 2026-09-22): the first-run theme, applied
 *  when this device has never chosen one. Chosen as the default
 *  surface for new visits; the Settings switcher still offers every
 *  theme and any device choice overrides this. Note that "default
 *  theme" and "the theme hosted by `:root`" are separate facts:
 *  `:root` in tokens.css remains station (the generated cascade is
 *  untouched), so booting into plain means explicitly setting
 *  data-theme="plain". */
export const DEFAULT_THEME: ThemeName = "plain";

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(THEMES, value);
}

/** Station is the theme `:root` hosts in tokens.css, so it is expressed
 *  as *no data-theme attribute*; every other theme — including
 *  DEFAULT_THEME (plain) on a first run — sets its own attribute.
 *  This is exactly how the generated cascade documents the override. */
export function applyThemeToDocument(theme: ThemeName): void {
  const root = document.documentElement;
  if (theme === "station") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

export function saveStoredTheme(theme: ThemeName): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private-mode storage failures must not break the applied theme.
  }
}

/** The theme this device last chose, or null (never invented). */
export function readStoredTheme(): ThemeName | null {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeName(raw) ? raw : null;
  } catch {
    return null;
  }
}
