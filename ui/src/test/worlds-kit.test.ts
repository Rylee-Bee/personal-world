/**
 * Worlds kit — source invariants for kit/src/base.css.
 *
 * The kit exists so tools can vendor the Worlds look without Tailwind. Two
 * rules keep that honest and themeable:
 *   1. base.css contains NO raw colours — every colour is a --pw-* token
 *      (only `transparent` / `currentColor` are allowed as literals);
 *   2. every --pw-* token base.css references is defined in the generated
 *      tokens.css, so no component can silently depend on a token that
 *      doesn't exist.
 *
 * These run in the jsdom "unit" project (vitest) and read the files from
 * disk; the e2e-kit Playwright suite proves the rendered result.
 */
import { readFileSync, existsSync } from "node:fs";
import { cwd } from "node:process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// vitest runs with cwd = ui/ (see package.json), so resolve from there rather
// than from import.meta.url — which jsdom rewrites to a non-file URL.
const baseCssPath = resolve(cwd(), "kit/src/base.css");
const tokensCssPath = resolve(cwd(), "src/generated/tokens.css");
const fontsDir = resolve(cwd(), "public/assets/fonts/");

const baseCss = readFileSync(baseCssPath, "utf-8");
const tokensCss = readFileSync(tokensCssPath, "utf-8");

/** Comments may describe colours freely; only real declarations are checked. */
const code = baseCss.replace(/\/\*[\s\S]*?\*\//g, "");

/** --pw-* custom properties defined by the generated tokens. */
const definedTokens = new Set(
  [...tokensCss.matchAll(/(--pw-[A-Za-z0-9_-]+)\s*:/g)].map((m) => m[1]),
);

/** Every `var(--…)` reference in base.css (comments stripped). */
const varReferences = [...code.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)].map((m) => m[1]);

/** CSS colour functions that are not `color-mix(in …)` wrappers. */
const COLOR_FUNCTION = /(?<![-\w])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|device-cmyk)\(/i;
/** Hex literals. */
const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/;
/** A small reserved-word guard (identifier-aware: won't match --pw-accent-green). */
const NAMED_COLOR =
  /(?<![-\w])(?:white|black|red|lime|blue|yellow|cyan|aqua|magenta|fuchsia|silver|gray|grey|maroon|olive|green|teal|navy|purple|orange)(?![-\w])/i;

describe("worlds kit / base.css", () => {
  it("exists and is non-trivial", () => {
    expect(baseCss.length).toBeGreaterThan(2000);
    expect(code).toContain("@font-face");
  });

  it("contains no raw colours (only --pw-* tokens, transparent, currentColor)", () => {
    const offences: string[] = [];
    const scan = (re: RegExp, kind: string) => {
      for (const m of code.matchAll(new RegExp(re, "gi"))) {
        const at = m.index ?? 0;
        offences.push(`${kind}: ${m[0]} … ${code.slice(Math.max(0, at - 30), at + 30).trim()}`);
      }
    };
    scan(HEX_COLOR, "hex");
    scan(COLOR_FUNCTION, "colour function");
    scan(NAMED_COLOR, "named colour");
    expect(offences, "base.css must not hard-code colours").toEqual([]);
  });

  it("references only --pw-* tokens", () => {
    const nonPw = varReferences.filter((name) => !name.startsWith("--pw-"));
    expect(nonPw, "base.css may only reference --pw-* custom properties").toEqual([]);
    expect(varReferences.length).toBeGreaterThan(50);
  });

  it("references only tokens that exist in tokens.css", () => {
    const missing = [...new Set(varReferences)].filter((name) => !definedTokens.has(name));
    expect(missing, "base.css references undefined tokens").toEqual([]);
  });

  it("loads only fonts that ship in public/assets/fonts", () => {
    const refs = [...baseCss.matchAll(/url\(fonts\/([^)]+)\)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const file of new Set(refs)) {
      expect(existsSync(resolve(fontsDir, file)), `missing font ${file}`).toBe(true);
    }
  });

  it("covers the required component vocabulary", () => {
    const required = [
      ".wk-btn", ".wk-btn--primary", ".wk-btn--quiet", ".wk-btn--danger",
      ".wk-card", ".wk-chip", ".wk-chip--accent",
      ".wk-status", ".wk-status--healthy", ".wk-status--degraded",
      ".wk-status--unhealthy", ".wk-status--unknown", ".wk-status--unreachable",
      ".wk-status--incompatible",
      ".wk-signal", ".wk-signal--good", ".wk-signal--update",
      ".wk-signal--waiting", ".wk-signal--critical",
      ".wk-field", ".wk-input", ".wk-select", ".wk-textarea", ".wk-label",
      ".wk-hint", ".wk-error", ".wk-table", ".wk-tabs", ".wk-drawer",
      ".wk-page", ".wk-stack", ".wk-cluster", ".wk-grid", ".wk-empty",
      ".wk-banner", ".wk-banner--info", ".wk-banner--warn", ".wk-banner--error",
      ".wk-code", ".wk-skip-link", ".wk-sr-only",
    ];
    const missing = required.filter((cls) => !code.includes(cls));
    expect(missing, "base.css is missing required classes").toEqual([]);
  });
});