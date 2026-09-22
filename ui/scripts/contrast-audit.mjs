#!/usr/bin/env node
/**
 * contrast-audit.mjs — C9 automated WCAG AA contrast check for the
 * token pairs the Track C components actually render (Settings Room,
 * Interests, their shared chrome), across ALL FOUR theme packs.
 *
 * Zero new dependencies: relative luminance + contrast ratio per the
 * WCAG 2.1 definition (sRGB linearization), thresholds 4.5:1 for the
 * normal-size text pairs this scope renders (micro/label/small are
 * all ≤14px, body 16px — none reaches the 18pt/14pt-bold "large"
 * exemption at the weights used) and 3:1 for the focus-ring /
 * underline non-text pairs (WCAG 1.4.11, and a11y contract §2.4
 * demands "sufficient contrast" for the indicator itself).
 *
 * Reads the GENERATED theme values (src/generated/tokens.css — whose
 * truth is design/tokens.json + design/themes/*.json) and writes
 * ui/reports/contrast-audit.md. Exit code 1 = any pair fails: the
 * gate is the point, not the report.
 *
 * The pair list is deliberately narrow: what these components render,
 * not every token in existence. Expanding it means editing PAIRS
 * where a NEW rendered pair appears — with the component that draws
 * it, in the same commit.
 *
 * Run: node scripts/contrast-audit.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKENS_CSS = path.join(UI_ROOT, "src/generated/tokens.css");
const OUT = path.join(UI_ROOT, "reports/contrast-audit.md");

// ─── Pairs rendered by Track C components ────────────────────────────
// fg / bg are token names; kind "text" → 4.5:1, "ui" → 3:1.

const PAIRS = [
  { fg: "--pw-text-primary", bg: "--pw-surface-canvas", kind: "text", where: "screen h1 + lead lines (Settings/Interests headers)" },
  { fg: "--pw-text-primary", bg: "--pw-surface-panel", kind: "text", where: "card headings, control labels, change-preview sentences, finding titles" },
  { fg: "--pw-text-primary", bg: "--pw-surface-hull", kind: "text", where: "current values inside selects/number inputs" },
  { fg: "--pw-text-secondary", bg: "--pw-surface-panel", kind: "text", where: "notes, saved/applied lines, descriptions, empty-state sentences, ghost-button text, section eyebrows, hints, provenance lines" },
  { fg: "--pw-text-secondary", bg: "--pw-surface-canvas", kind: "text", where: "error/notice lines that sit directly on the page background" },
  { fg: "--pw-text-secondary", bg: "--pw-surface-hull", kind: "text", where: "secondary copy over input grounds" },
  { fg: "--pw-text-muted", bg: "--pw-surface-canvas", kind: "text", where: "micro/small helper copy on the page background (added 2026-09-22: axe found the starfield muted token failing here — the audit's blind spot, not axe's)" },
  { fg: "--pw-text-muted", bg: "--pw-surface-panel", kind: "text", where: "muted copy inside cards (Records hints, category meta)" },
  { fg: "--pw-text-muted", bg: "--pw-surface-elevated", kind: "text", where: "muted copy on elevated chips/bubbles (chat timestamps, shrunk meta lines)" },
  { fg: "--pw-surface-void", bg: "--pw-accent-warm", kind: "text", where: "Apply / Check primary-button label" },
  { fg: "--pw-accent-primary", bg: "--pw-surface-panel", kind: "text", where: "skip-link revealed text on its panel ground" },
  { fg: "--pw-accent-primary", bg: "--pw-surface-hull", kind: "ui", where: "focus ring over input fills (§2.4)" },
  { fg: "--pw-accent-primary", bg: "--pw-surface-panel", kind: "ui", where: "focus ring + link underline over card grounds (§2.4)" },
  { fg: "--pw-accent-primary", bg: "--pw-surface-canvas", kind: "ui", where: "focus ring where it crosses the page background" },
];

// ─── tokens.css theme-block parser ───────────────────────────────────

function parseThemes(css) {
  const themes = { station: {} };
  const blockRe = /(?::root|\[data-theme="([^"]+)"\])\s*\{([^}]*)\}/g;
  let m;
  while ((m = blockRe.exec(css)) !== null) {
    // un-named :root blocks = immutable constants + the default theme
    // (station); named [data-theme="x"] blocks override it.
    const name = m[1] ?? "station";
    themes[name] = themes[name] ?? {};
    for (const decl of m[2].split(";")) {
      const idx = decl.indexOf(":");
      if (idx === -1) continue;
      const prop = decl.slice(0, idx).trim();
      const val = decl.slice(idx + 1).trim();
      if (prop.startsWith("--pw-") && val) themes[name][prop] = val;
    }
  }
  return themes;
}

// ─── WCAG math ───────────────────────────────────────────────────────

function hexToRgb(hex) {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function relLuminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(fgHex, bgHex) {
  const f = hexToRgb(fgHex);
  const b = hexToRgb(bgHex);
  if (!f || !b) return null;
  const l1 = relLuminance(f);
  const l2 = relLuminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// ─── run ─────────────────────────────────────────────────────────────

const css = fs.readFileSync(TOKENS_CSS, "utf8");
const themes = parseThemes(css);
const themeNames = Object.keys(themes);
if (themeNames.length < 4) {
  console.error(`contrast-audit: parsed ${themeNames.length} theme blocks, expected ≥4 — parser drift?`);
  process.exit(2);
}

// Anti-regression: the C9 audit passed by MOVING components off
// --pw-text-muted (that token is below AA on these grounds in moss,
// ocean and starfield). Design tokens are not the audit's to rewrite,
// so if a Track C component reaches for muted again, the audit fails.
const MUTED_BANNED_IN = [
  "src/screens/Settings/SettingsRoom.tsx",
  "src/screens/Settings/Settings.tsx",
  "src/screens/Interests/Interests.tsx",
];
const mutedReusers = MUTED_BANNED_IN.filter((f) =>
  fs.readFileSync(path.join(UI_ROOT, f), "utf8").includes("text-[var(--pw-text-muted)]"),
);

const results = [];
let failures = 0;
for (const theme of themeNames) {
  for (const p of PAIRS) {
    const fg = themes[theme][p.fg];
    const bg = themes[theme][p.bg];
    const need = p.kind === "text" ? 4.5 : 3.0;
    if (!fg || !bg) {
      results.push({ theme, ...p, ratio: null, need, pass: false, note: "token absent in this theme block" });
      failures += 1;
      continue;
    }
    const r = ratio(fg, bg);
    // one decimal of honest rounding, then a hard comparison
    const rr = Math.round(r * 100) / 100;
    const pass = rr + 1e-9 >= need;
    if (!pass) failures += 1;
    results.push({ theme, ...p, fg, bg, ratio: rr, need, pass });
  }
}

const lines = [];
lines.push("# Contrast audit — Track C rendered token pairs (C9)");
lines.push("");
lines.push("Generated by `ui/scripts/contrast-audit.mjs` (node, zero deps, WCAG 2.1 relative");
lines.push("luminance). Thresholds: **4.5:1** for every text pair in scope (all text these");
lines.push("components render is ≤16px at normal or semibold weight — none reaches the");
lines.push("large-text exemption), **3:1** for the focus-ring/underline non-text pairs.");
lines.push("All four theme packs are audited, because the Settings theme picker lets the");
lines.push("person move the whole surface into any of them.");
lines.push("");
lines.push(`**Result: ${failures === 0 ? "PASS — 0 failing pairs" : `FAIL — ${failures} failing pair(s)`} (${results.length} pairs = ${PAIRS.length} × ${themeNames.length} themes)**`);
lines.push("");
for (const theme of themeNames) {
  lines.push(`## ${theme}`);
  lines.push("");
  lines.push(`| fg | bg | ratio | need | pass | where it renders |`);
  lines.push(`| --- | --- | --- | --- | --- | --- |`);
  for (const r of results.filter((x) => x.theme === theme)) {
    lines.push(
      `| \`${r.fg}\` ${r.fg ?? "?"} | \`${r.bg}\` ${r.bg ?? "?"} | ${r.ratio ?? "n/a"} | ${r.need} | ${r.pass ? "yes" : `**no — ${r.note ?? "fix required"}**`} | ${r.where} |`,
    );
  }
  lines.push("");
}
lines.push("Notes for the morning read:");
lines.push("");
lines.push("- **C9 fix history (2026-09-21):** every text pair in scope first passed at");
lines.push("  4.5:1 in station only — `--pw-text-muted` computed 3.5–4.4:1 on panel/hull/");
lines.push("  canvas in moss, ocean, and starfield (12 of the first 48 audited pairs");
lines.push("  failed). Design tokens are design truth, not the audit's to rewrite, so the");
lines.push("  Track C components moved from muted to `--pw-text-secondary` (and its");
lines.push("  skip-link text to `--pw-accent-primary` on panel). The muted→secondary move");
lines.push("  is guarded above: a Track C file reaching for muted again fails the audit.");
lines.push("- Pair list = what the Track C components actually draw (Settings Room,");
lines.push("  Interests, their headings/notes/buttons/rings). It is not the token");
lines.push("  universe; extend it with the component that introduces a new pair.");
lines.push("- Today/Journal/Vault/Chat still use `--pw-text-muted` for their eyebrows;");
lines.push("  those are other tracks' surfaces — recorded, not silently fixed here.");
lines.push("");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join("\n"));

for (const f of mutedReusers) {
  console.log(`  FAIL ${f} reintroduces --pw-text-muted text (below AA in 3 themes)`);
}

const summary = results
  .filter((r) => !r.pass)
  .map((r) => `${r.theme}: ${r.fg}/${r.bg} = ${r.ratio ?? "n/a"} (need ${r.need})`);
console.log(
  `contrast-audit: ${results.length} pairs · ${failures + mutedReusers.length} failing${summary.length ? `\n${summary.map((s) => "  FAIL " + s).join("\n")}` : ""}\nreport → ${path.relative(UI_ROOT, OUT)}`,
);
process.exit(failures === 0 && mutedReusers.length === 0 ? 0 : 1);
