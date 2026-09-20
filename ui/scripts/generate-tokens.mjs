#!/usr/bin/env node

/**
 * generate-tokens.mjs
 *
 * Generates CSS custom properties and TypeScript types from theme files.
 *
 * CSS: manual generation (theme files don't match Style Dictionary format)
 * TypeScript: Style Dictionary for type-safe token references
 *
 * Usage:
 *   node scripts/generate-tokens.mjs           # all themes
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { dirname, resolve, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const themesDir = resolve(__dirname, "../../design/themes");
const cssOutput = resolve(__dirname, "../src/generated/tokens.css");
const tsOutput = resolve(__dirname, "../src/generated/tokens.ts");

const themeFiles = readdirSync(themesDir).filter((f) => f.endsWith(".json"));

// ─── CSS Generation ───────────────────────────────────────────────────────

let css = `/**
 * PROJECT WORLDS — Generated Design Tokens
 *
 * ⚠️  THIS FILE IS GENERATED. Do not edit by hand.
 * Source: design/themes/*.json
 * Generator: scripts/generate-tokens.mjs
 *
 * Run: node scripts/generate-tokens.mjs
 */\n\n`;

for (const file of themeFiles) {
  const themeName = basename(file, ".json");
  const data = JSON.parse(readFileSync(resolve(themesDir, file), "utf-8"));

  if (themeName === "station") {
    css += `:root {\n`;
  } else {
    css += `\n[data-theme="${themeName}"] {\n`;
  }

  for (const [category, values] of Object.entries(data)) {
    if (category === "_comment" || category === "_author" || category.startsWith("_")) continue;
    if (typeof values !== "object" || Array.isArray(values)) continue;

    // Add category comment
    const comment = values._comment || "";
    if (comment) {
      css += `  /* ${comment.substring(0, 80)} */\n`;
    }

    for (const [prop, val] of Object.entries(values)) {
      if (prop === "_comment" || prop.startsWith("_")) continue;
      if (typeof val !== "string") continue;

      const cssVar = `--pw-${category}-${prop.replace(/\./g, "-")}`;
      css += `  ${cssVar}: ${val};\n`;
    }
    css += `\n`;
  }

  css += `}\n`;
}

writeFileSync(cssOutput, css, "utf-8");
console.log(`✓ Generated ${cssOutput}`);
console.log(`  Themes: ${themeFiles.map((f) => basename(f, ".json")).join(", ")}`);

// ─── TypeScript Generation ────────────────────────────────────────────────

// Build a union of all token paths from the station theme (base)
const stationData = JSON.parse(
  readFileSync(resolve(themesDir, "station.json"), "utf-8"),
);

const tokenEntries = [];
for (const [category, values] of Object.entries(stationData)) {
  if (category === "_comment" || category.startsWith("_")) continue;
  if (typeof values !== "object" || Array.isArray(values)) continue;

  for (const [prop] of Object.entries(values)) {
    if (prop === "_comment" || prop.startsWith("_")) continue;
    const cssVar = `--pw-${category}-${prop.replace(/\./g, "-")}`;
    tokenEntries.push({ cssVar, category, prop });
  }
}

const ts = `/**
 * PROJECT WORLDS — Generated Design Token Types
 *
 * ⚠️  THIS FILE IS GENERATED. Do not edit by hand.
 * Source: design/themes/station.json
 * Generator: scripts/generate-tokens.mjs
 *
 * Usage:
 *   import { TOKENS } from "./generated/tokens";
 *   element.style.color = TOKENS["--pw-text-primary"];
 */

/** All available CSS custom property names */
export type TokenName = ${tokenEntries.map((t) => `"${t.cssVar}"`).join("\n  | ")};

/** Token values keyed by CSS variable name */
export const TOKENS: Record<TokenName, string> = {
${tokenEntries.map((t) => `  "${t.cssVar}": "var(${t.cssVar})"`).join(",\n")}
} as const;

/** Get a token value as a CSS string */
export function token(name: TokenName): string {
  return \`var(\${name})\`;
}

/** Theme names available */
export type ThemeName = "station" | "starfield" | "ocean" | "moss";

/** All theme selectors */
export const THEMES: Record<ThemeName, string> = {
  station: ":root",
  starfield: '[data-theme="starfield"]',
  ocean: '[data-theme="ocean"]',
  moss: '[data-theme="moss"]',
} as const;
`;

writeFileSync(tsOutput, ts, "utf-8");
console.log(`✓ Generated ${tsOutput}`);
console.log(`  Token entries: ${tokenEntries.length}`);
