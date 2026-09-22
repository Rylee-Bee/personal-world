#!/usr/bin/env node
/**
 * door-coverage.mjs — C6 manifest-capability door coverage (Track C).
 *
 * Lists every curated endpoint row of src/personal_world/api_manifest.py
 * (the same table GET /api/manifest serves) and classifies whether the
 * Station vNext UI (ui/src, production import closure starting at
 * main.tsx) reaches it:
 *
 *   screen-reachable  the endpoint's wrapper function in src/data/api.ts
 *                     (or the hook that wraps it in src/data/hooks.ts)
 *                     is imported by a file under src/app, src/screens
 *                     or src/components — a person can walk to a door
 *                     from a rendered screen.
 *   client-callable   the path literal appears in the production module
 *                     closure (wrapped in the client) but no screen
 *                     imports it yet — the door exists, the hallway
 *                     does not.
 *   uncovered         the production closure never mentions it.
 *
 *   internal-marked   rows the manifest itself marks internal. The
 *                     curated table carries NO such marker (documented
 *                     -internal routes are deliberately absent from
 *                     the table — see api_manifest.py's docstring and
 *                     docs/PARITY-CORE-64.md), so this count is 0 and
 *                     that is the truth, not a shortfall to pad.
 *
 * Uncovered is EXPECTED — the rebuild is in progress. This report
 * never stubs fake doors to improve its own numbers: coverage comes
 * only from reading real source, and it is a read-only script:
 * zero new deps, nothing written except ui/reports/door-coverage.md.
 *
 * Run: node scripts/door-coverage.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(UI_ROOT, "..");
const MANIFEST_PY = path.join(REPO_ROOT, "src/personal_world/api_manifest.py");
const SRC = path.join(UI_ROOT, "src");
const OUT = path.join(UI_ROOT, "reports", "door-coverage.md");

// ─── 1. Parse the curated rows out of the Python table ───────────────

const VERBS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);
const GATE_WORDS = new Set(["none", "step-up", "proposal"]);
const KIND_WORDS = new Set(["read", "write"]);
const AUTH_WORDS = new Set(["public", "authenticated"]);

function extractEBlocks(source) {
  const blocks = [];
  const marker = "_e(";
  let idx = 0;
  while ((idx = source.indexOf(marker, idx)) !== -1) {
    let depth = 0;
    let end = idx + marker.length - 1;
    let inStr = null; // current string quote char
    for (let i = idx + marker.length - 1; i < source.length; i++) {
      const ch = source[i];
      if (inStr) {
        if (ch === "\\") i += 1;
        else if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === '"' || ch === "'") inStr = ch;
      else if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    blocks.push(source.slice(idx + marker.length, end));
    idx = end + 1;
  }
  return blocks;
}

function stringLiterals(block) {
  // Double- or single-quoted literals, in order, Python-adjacent
  // concatenation flattened (a note split across lines becomes the
  // join of its pieces, which is fine — we only read the first six).
  return [...block.matchAll(/"([^"\n]*)"|'([^'\n]*)'/g)].map((m) => m[1] ?? m[2]);
}

function parseManifestRows() {
  const source = fs.readFileSync(MANIFEST_PY, "utf8");
  const rows = [];
  for (const block of extractEBlocks(source)) {
    const strs = stringLiterals(block);
    // Anchor on the verb: [id, METHOD, /path, capability, kind, gate, [auth], [note]]
    for (let i = 0; i < strs.length - 2; i++) {
      if (
        VERBS.has(strs[i]) &&
        strs[i + 1]?.startsWith("/") &&
        KIND_WORDS.has(strs[i + 3]) &&
        GATE_WORDS.has(strs[i + 4])
      ) {
        const method = strs[i];
        const p = strs[i + 1];
        const id = strs[i - 1] ?? `${method} ${p}`;
        const capability = strs[i + 2];
        const kind = strs[i + 3];
        const gate = strs[i + 4];
        const maybeAuth = strs[i + 5];
        const auth = AUTH_WORDS.has(maybeAuth) ? maybeAuth : "authenticated";
        rows.push({ method, path: p, capability, kind, gate, auth, id });
        break;
      }
    }
  }
  // de-dupe by (method, path) — the same pair appears once in the table
  const seen = new Set();
  return rows.filter((r) => {
    const key = `${r.method} ${r.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── 2. Production module closure from src/main.tsx ──────────────────

function resolveImport(fromFile, spec) {
  if (!spec.startsWith(".")) return null; // package import
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

function collectClosure(entry) {
  const files = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift();
    if (file === null || files.has(file)) continue;
    files.add(file);
    const source = fs.readFileSync(file, "utf8");
    for (const m of source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)) {
      const resolved = resolveImport(file, m[1]);
      if (resolved) queue.push(resolved);
    }
    // side-effect imports: import "./styles/world.css" etc.
    for (const m of source.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g)) {
      const resolved = resolveImport(file, m[1]);
      if (resolved) queue.push(resolved);
    }
  }
  return files;
}

const mainFile = path.join(SRC, "main.tsx");
const closure = collectClosure(mainFile);
// Generated types are contract text, not doors; they never count.
const closureCode = [...closure].filter((f) => !f.includes(`${path.sep}generated${path.sep}`));

// CSS imports are skipped by resolveImport (no .ts twin) — fine.

// ─── 3. api.ts path→wrapper map and hooks.ts wrapper→hook map ────────

function readIfExists(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

function splitExports(source) {
  // name → body text until the next top-level `export `
  const parts = [];
  const re = /^export (?:const|function|async function|class)\s+(\w+)/gm;
  let match;
  const hits = [];
  while ((match = re.exec(source)) !== null) {
    hits.push({ name: match[1], start: match.index });
  }
  for (let i = 0; i < hits.length; i++) {
    const end = i + 1 < hits.length ? hits[i + 1].start : source.length;
    parts.push({ name: hits[i].name, body: source.slice(hits[i].start, end) });
  }
  return parts;
}

const apiSource = readIfExists(path.join(SRC, "data", "api.ts"));
const hooksSource = readIfExists(path.join(SRC, "data", "hooks.ts"));

const apiExports = splitExports(apiSource);
const hooksExports = splitExports(hooksSource);

function methodPathPairs(body) {
  // openapi-fetch call shapes in data/api.ts (verified 2026-09-21):
  //   api.GET("/x", …)  and  sendBody("PUT", "/x", body)
  const pairs = new Set();
  for (const m of body.matchAll(/api\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(\s*["']([^"']+)["']/g)) {
    pairs.add(`${m[1]} ${m[2]}`);
  }
  for (const m of body.matchAll(/sendBody\(\s*["'](GET|POST|PUT|DELETE|PATCH)["']\s*,\s*["']([^"']+)["']/g)) {
    pairs.add(`${m[1]} ${m[2]}`);
  }
  return pairs;
}

// wrapper names (api.ts) whose body references a (method, path) call
const wrapperByPath = new Map();
for (const { name, body } of apiExports) {
  for (const key of methodPathPairs(body)) {
    if (!wrapperByPath.has(key)) wrapperByPath.set(key, new Set());
    wrapperByPath.get(key).add(name);
  }
}

// hook names whose body calls a wrapper
const hooksByWrapper = new Map();
for (const { name, body } of hooksExports) {
  for (const { name: wrapper } of apiExports) {
    if (new RegExp(`\\b${wrapper}\\b`).test(body)) {
      if (!hooksByWrapper.has(wrapper)) hooksByWrapper.set(wrapper, new Set());
      hooksByWrapper.get(wrapper).add(name);
    }
  }
}

// names imported anywhere under app/screens/components (the screen tier)
const screenTier = closureCode.filter(
  (f) =>
    f.includes(`${path.sep}screens${path.sep}`) ||
    f.includes(`${path.sep}components${path.sep}`) ||
    f.includes(`${path.sep}app${path.sep}`),
);
const screenNames = new Set();
for (const f of screenTier) {
  const source = fs.readFileSync(f, "utf8");
  for (const m of source.matchAll(
    /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*["'][^"']+["']/g,
  )) {
    for (const raw of m[1].split(",")) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (name) screenNames.add(name);
    }
  }
  for (const m of source.matchAll(/import\s+(\w+)\s+from\s*["'][^"']+["']/g)) {
    screenNames.add(m[1]);
  }
}

// ─── 4. Classify every manifest row ──────────────────────────────────

function classify(row) {
  const key = `${row.method} ${row.path}`;
  const wrappers = wrapperByPath.get(key) ?? new Set();
  for (const wrapper of wrappers) {
    // reachable if the wrapper or any hook wrapping it is imported by the screen tier
    if (screenNames.has(wrapper)) return "screen-reachable";
    for (const hook of hooksByWrapper.get(wrapper) ?? []) {
      if (screenNames.has(hook)) return "screen-reachable";
    }
  }
  // method-aware second look: within a small line window of the path
  // literal, this verb's call appears (openapi-fetch/sendBody calls can
  // wrap lines, so same-line matching alone false-negatives)
  for (const f of closureCode) {
    const lines = fs.readFileSync(f, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes(`"${row.path}"`) && !lines[i].includes(`'${row.path}'`)) {
        continue;
      }
      const window = lines.slice(Math.max(0, i - 3), i + 2).join("\n");
      if (
        window.includes(`api.${row.method}(`) ||
        window.includes(`"${row.method}",`) ||
        window.includes(`'${row.method}',`)
      ) {
        return "client-callable";
      }
    }
  }
  return "uncovered";
}

const rows = parseManifestRows();
rows.sort((a, b) => (`${a.method} ${a.path}` < `${b.method} ${b.path}` ? -1 : 1));
const verdicts = rows.map((r) => ({ ...r, verdict: classify(r) }));

const count = (v) => verdicts.filter((r) => r.verdict === v).length;
const counts = {
  total: verdicts.length,
  "screen-reachable": count("screen-reachable"),
  "client-callable": count("client-callable"),
  uncovered: count("uncovered"),
  "internal-marked": 0,
};

// ─── 5. Emit the report ──────────────────────────────────────────────

const byCap = new Map();
for (const r of verdicts) {
  if (!byCap.has(r.capability)) byCap.set(r.capability, []);
  byCap.get(r.capability).push(r);
}

const lines = [];
lines.push("# Door coverage — manifest capability rows vs UI paths (C6)");
lines.push("");
lines.push(`Generated by \`ui/scripts/door-coverage.mjs\` (node, zero deps).`);
lines.push(`Rows parsed from \`src/personal_world/api_manifest.py\` — the curated table`);
lines.push(`\`GET /api/manifest\` serves as \`endpoints\`.`);
lines.push("");
lines.push(`Regenerate: \`cd ui && node scripts/door-coverage.mjs\``);
lines.push("");
lines.push("## Definitions (what each verdict was computed from)");
lines.push("");
lines.push("- **screen-reachable** — a person can reach the endpoint from a rendered screen: its `src/data/api.ts` wrapper (or the `src/data/hooks.ts` hook around it) is imported under `src/app`, `src/screens`, or `src/components`, all inside the production import closure from `src/main.tsx`.");
lines.push("- **client-callable** — the production closure pairs this verb with this path (an `api.VERB(\"…\")` or `sendBody(\"VERB\", \"…\")` call within a small line window), but no screen tier imports the wrapper: the door exists, the hallway does not.");
lines.push("- **uncovered** — the production closure never mentions it. Uncovered is expected mid-rebuild; nothing here was stubbed to shrink this number.");
lines.push("- **internal-marked** — rows the manifest marks internal. The curated table carries no such marker, and documented-internal routes (UI shell, static assets) are deliberately absent from the table (`api_manifest.py` docstring; `docs/PARITY-CORE-64.md` verdict vocabulary) — so the honest count is 0.");
lines.push("");
lines.push("## Counts");
lines.push("");
lines.push("| verdict | rows |");
lines.push("| --- | --- |");
lines.push(`| screen-reachable | ${counts["screen-reachable"]} |`);
lines.push(`| client-callable | ${counts["client-callable"]} |`);
lines.push(`| uncovered | ${counts.uncovered} |`);
lines.push(`| internal-marked | 0 (no row-level marker exists — see definitions) |`);
lines.push(`| **total manifest rows** | **${counts.total}** |`);
lines.push("");
lines.push("## Rows by capability");
lines.push("");
for (const [cap, list] of [...byCap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
  lines.push(`### ${cap} (${list.length})`);
  lines.push("");
  lines.push("| method | path | gate | kind | verdict |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const r of list) {
    lines.push(`| ${r.method} | \`${r.path}\` | ${r.gate} | ${r.kind} | ${r.verdict} |`);
  }
  lines.push("");
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join("\n"));
console.log(
  `door-coverage: ${counts.total} rows · ${counts["screen-reachable"]} screen-reachable · ${counts["client-callable"]} client-callable · ${counts.uncovered} uncovered · 0 internal-marked → ${path.relative(REPO_ROOT, OUT)}`,
);
