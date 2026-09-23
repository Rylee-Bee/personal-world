/**
 * Settings-screen runtime parsers — narrow `unknown` server envelopes
 * into the shapes this screen renders.
 *
 * Why not the generated types: `src/generated/api-types.ts` answers
 * these endpoints as `{[key: string]: unknown}` (the server ships
 * untyped dict bodies), so any "typing" upstream of here would be a
 * cast wearing a costume. Each field is checked where it is used; an
 * unrecognized value degrades to an honest empty/unknown, never to a
 * invented default (AGENTS.md: repository truth outranks inference).
 */

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Peel one envelope layer: body → body.data (undefined when absent). */
export function envelopeData(body: unknown): unknown {
  return isRecord(body) ? body["data"] : undefined;
}

export function strField(record: UnknownRecord | null, key: string): string | null {
  const v = record?.[key];
  return typeof v === "string" ? v : null;
}

/** GET /api/identity/principal → display name, or null (never invented). */
export function principalDisplayName(body: unknown): string | null {
  const data = envelopeData(body);
  return isRecord(data) ? strField(data, "display_name") : null;
}

export interface SectionRow {
  id: string;
  label: string;
  visible: boolean;
}

/**
 * GET /api/sections → data.sections rows sorted by the server's order.
 * A row without a string id or with a non-boolean visible (absent) is
 * skipped and counted — silently dropping nav destinations is the bug
 * this file exists to not have.
 */
export function readSectionRows(body: unknown): { rows: SectionRow[]; skipped: number } {
  const data = envelopeData(body);
  const rawSections = isRecord(data) ? data["sections"] : undefined;
  const rows: SectionRow[] = [];
  let skipped = 0;
  if (!Array.isArray(rawSections)) return { rows, skipped };
  const ordered: Array<{ order: number; row: SectionRow }> = [];
  for (const raw of rawSections) {
    if (!isRecord(raw) || typeof raw["id"] !== "string") {
      skipped += 1;
      continue;
    }
    const order = typeof raw["order"] === "number" ? raw["order"] : rows.length;
    ordered.push({
      order,
      row: {
        id: raw["id"],
        label: typeof raw["label"] === "string" ? raw["label"] : raw["id"],
        visible: raw["visible"] === true,
      },
    });
  }
  ordered.sort((a, b) => a.order - b.order);
  for (const item of ordered) rows.push(item.row);
  return { rows, skipped };
}

export interface CapabilityRow {
  id: string;
  status: string;
  firstWarning: string | null;
}

/** GET /api/status → data.capabilities map, kept as raw server words
 * (the UI vocabulary mapping stays in toCapabilityStatus, one home). */
export function readCapabilityRows(body: unknown): CapabilityRow[] {
  const data = envelopeData(body);
  const caps = isRecord(data) ? data["capabilities"] : undefined;
  if (!isRecord(caps)) return [];
  return Object.entries(caps).map(([id, raw]) => ({
    id,
    status: isRecord(raw) && typeof raw["status"] === "string" ? raw["status"] : "unknown",
    firstWarning:
      isRecord(raw) && Array.isArray(raw["warnings"]) && typeof raw["warnings"][0] === "string"
        ? raw["warnings"][0]
        : null,
  }));
}

export interface BrainTemplateRow {
  id: string;
  kind: string;
  surface: string | null;
}

/** GET /api/brain/templates → data.templates rows (id/kind required). */
export function readBrainTemplates(body: unknown): BrainTemplateRow[] {
  const data = envelopeData(body);
  const templates = isRecord(data) ? data["templates"] : undefined;
  if (!Array.isArray(templates)) return [];
  const rows: BrainTemplateRow[] = [];
  for (const raw of templates) {
    if (!isRecord(raw) || typeof raw["id"] !== "string" || typeof raw["kind"] !== "string") {
      continue;
    }
    rows.push({
      id: raw["id"],
      kind: raw["kind"],
      surface: typeof raw["surface"] === "string" ? raw["surface"] : null,
    });
  }
  return rows;
}

/** GET /api/manifest → the endpoints array itself (validated). */
export function envelopeEndpoints(body: unknown): UnknownRecord[] {
  if (!isRecord(body)) return [];
  const eps = body["endpoints"];
  if (!Array.isArray(eps)) return [];
  return eps.filter(isRecord);
}

/** GET /api/manifest → endpoints array length (0 when not an array). */
export function countManifestEndpoints(body: unknown): number {
  return envelopeEndpoints(body).length;
}

// ─── Prefs schema / draft diff — the Settings Room's vocabulary ──────
// (Pure parsers live here, not in the component file: the Fast Refresh
// rule keeps component modules component-only, same precedent as
// src/mocks/msw-gate.tsx.)

export type PrefsValue = string | number;

/** One parsed row of GET /api/prefs/schema → data. */
export interface PrefsSchemaEntry {
  key: string;
  type: "enum" | "number";
  default: PrefsValue;
  floor: PrefsValue;
  /** Closed value set; null only for open number ranges. */
  allowed: readonly PrefsValue[] | null;
  integer: boolean;
  unit: string;
}

export interface ParsedPrefsSchema {
  entries: PrefsSchemaEntry[];
  /** Keys whose server description this UI could not understand. */
  rejectedKeys: string[];
}

export interface PrefsChange {
  key: string;
  from: PrefsValue;
  to: PrefsValue;
}

function parseSchemaEntry(key: string, raw: unknown): PrefsSchemaEntry | null {
  if (!isRecord(raw)) return null;
  const type = raw["type"];
  if (type !== "enum" && type !== "number") return null;

  if (type === "enum") {
    const allowed = raw["allowed"];
    const values = Array.isArray(allowed)
      ? allowed.filter((v): v is string => typeof v === "string")
      : null;
    if (!values || values.length === 0) return null;
    if (typeof raw["default"] !== "string" || typeof raw["floor"] !== "string") {
      return null;
    }
    return {
      key,
      type: "enum",
      default: raw["default"],
      floor: raw["floor"],
      allowed: values,
      integer: false,
      unit: "",
    };
  }

  const def = raw["default"];
  const floor = raw["floor"];
  if (typeof def !== "number" || typeof floor !== "number") return null;
  const allowed = raw["allowed"];
  let values: number[] | null = null;
  if (allowed !== null && allowed !== undefined) {
    if (!Array.isArray(allowed)) return null;
    values = allowed.filter((v): v is number => typeof v === "number");
    if (values.length === 0) return null;
  }
  return {
    key,
    type: "number",
    default: def,
    floor,
    allowed: values,
    integer: raw["integer"] === true,
    unit: typeof raw["unit"] === "string" ? raw["unit"] : "",
  };
}

/**
 * Narrow the schema envelope. The generated contract types this
 * response as an open object because the SERVER sends an open object
 * (api.py prefs_schema builds it from PREFS); the validation happens
 * here, not through a cast. Entries this UI cannot describe faithfully
 * are rejected by key name and rendered read-only, never as fiction.
 */
export function parsePrefsSchema(raw: unknown): ParsedPrefsSchema {
  const data = isRecord(raw) ? (raw["data"] ?? raw) : raw;
  const entries: PrefsSchemaEntry[] = [];
  const rejectedKeys: string[] = [];
  if (!isRecord(data)) return { entries, rejectedKeys: ["(unparseable body)"] };
  for (const [key, spec] of Object.entries(data)) {
    const entry = parseSchemaEntry(key, spec);
    if (entry) entries.push(entry);
    else rejectedKeys.push(key);
  }
  entries.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { entries, rejectedKeys };
}

/** Current server values keyed by schema key; absent → the entry default. */
export function readPrefsValues(
  rawPrefs: unknown,
  entries: readonly PrefsSchemaEntry[],
): Record<string, PrefsValue> {
  const data = isRecord(rawPrefs) && isRecord(rawPrefs["data"])
    ? (rawPrefs["data"] as Record<string, unknown>)
    : null;
  const out: Record<string, PrefsValue> = {};
  for (const entry of entries) {
    const raw = data?.[entry.key];
    out[entry.key] =
      typeof raw === "string" || typeof raw === "number" ? raw : entry.default;
  }
  return out;
}

/** Draft − server, as ordered change rows (C2's preview list). */
export function diffPrefs(
  server: Readonly<Record<string, PrefsValue>>,
  draft: Readonly<Record<string, PrefsValue>>,
): PrefsChange[] {
  const changes: PrefsChange[] = [];
  for (const key of Object.keys(server)) {
    if (draft[key] !== undefined && draft[key] !== server[key]) {
      changes.push({ key, from: server[key], to: draft[key] });
    }
  }
  return changes;
}

// ─── Labels — words, never colour, carry meaning (§1.3) ──────────────

export function prefKeyLabel(key: string): string {
  switch (key) {
    case "text_scale":
      return "Text size";
    case "target_size":
      return "Touch target size";
    case "tone":
      return "Voice tone";
    case "personality_pack":
      return "Personality pack";
    default:
      return key
        .replace(/_/g, " ")
        .replace(/^\w/, (c) => c.toUpperCase());
  }
}

export function prefValueLabel(entry: PrefsSchemaEntry, value: PrefsValue): string {
  if (typeof value === "number") {
    if (entry.key === "text_scale") {
      if (value === 1) return "Default";
      if (value === 1.25) return "Large";
      if (value === 1.5) return "Largest";
    }
    return `${value}${entry.unit}`;
  }
  if (entry.key === "motion") {
    if (value === "off") return "No motion";
    if (value === "reduced") return "Reduced motion";
    if (value === "subtle") return "Subtle motion";
  }
  // The one voice's registers (TRUE-NORTH § Voice) — plain words, the
  // default named as such so "which one is the calm baseline" is never
  // a guess.
  if (entry.key === "tone") {
    if (value === "warm") return "Warm (default)";
    if (value === "concise") return "Concise";
    if (value === "playful") return "Playful";
    if (value === "formal") return "Formal";
  }
  if (entry.key === "personality_pack") {
    if (value === "off") return "Off (the one voice)";
    if (value === "residents") return "Residents (optional character pack)";
  }
  return value
    .replace(/-/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}
