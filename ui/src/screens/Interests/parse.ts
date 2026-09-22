/**
 * Interests-screen runtime parsers — narrow the discovery envelopes
 * into what this view can honestly render.
 *
 * Field shapes verified 2026-09-21 against the emitting server code,
 * not against hope:
 *   GET /api/discovery/status → {ok, status, data} where data comes
 *     from providers/native_discovery.py `NativeDiscovery.observe()`:
 *     {sources[], interests[], items[], source_count, interest_count,
 *     item_count}. (items[] is the engine's in-memory set — observe()
 *     does not load past finds from disk, so this view does not treat
 *     it as the archive it is not.)
 *   GET /api/discovery/discover → data from `NativeDiscovery.discover()`:
 *     {items[], count, sources_queried}; each item is ContentItem
 *     .to_dict(): {id, title, source, content_type, url, description,
 *     tags, discovered_at, provenance}. Engine-backed items carry
 *     provenance {engine, source_type} (see _discover_engine).
 *
 * A row the parsers cannot verify is skipped and counted; the skipped
 * count surfaces as one honest line, never as silence.
 */

import { isRecord, envelopeData, type UnknownRecord } from "../Settings/parse";

export interface DiscoverySourceRow {
  id: string;
  name: string;
  source_type: string;
  enabled: boolean;
}

export interface DiscoveryInterestRow {
  id: string;
  name: string;
  category: string | null;
  created_at: string | null;
}

export interface DiscoveryFinding {
  id: string;
  title: string;
  source: string;
  content_type: string;
  url: string | null;
  description: string | null;
  discovered_at: string | null;
  provenance: UnknownRecord;
}

export interface DiscoveryStatus {
  sources: DiscoverySourceRow[];
  interests: DiscoveryInterestRow[];
  /** Rows dropped because the server described them in an unknown shape. */
  skippedRows: number;
  /** The envelope answered ok:false (soft failure) — warnings verbatim. */
  softFailure: { status: string | null; warnings: string[] } | null;
}

export interface DiscoverRun {
  items: DiscoveryFinding[];
  count: number;
  sourcesQueried: number;
  skippedRows: number;
  softFailure: { status: string | null; warnings: string[] } | null;
}

function parseSource(raw: unknown): DiscoverySourceRow | null {
  if (!isRecord(raw)) return null;
  const { id, name, source_type } = raw;
  if (typeof id !== "string" || typeof name !== "string" || typeof source_type !== "string") {
    return null;
  }
  return { id, name, source_type, enabled: raw["enabled"] === true };
}

function parseInterest(raw: unknown): DiscoveryInterestRow | null {
  if (!isRecord(raw)) return null;
  const { id, name } = raw;
  if (typeof id !== "string" || typeof name !== "string") return null;
  return {
    id,
    name,
    category: typeof raw["category"] === "string" ? raw["category"] : null,
    created_at: typeof raw["created_at"] === "string" ? raw["created_at"] : null,
  };
}

function parseFinding(raw: unknown): DiscoveryFinding | null {
  if (!isRecord(raw)) return null;
  const { id, title, source, content_type } = raw;
  if (
    typeof id !== "string" ||
    typeof title !== "string" ||
    typeof source !== "string" ||
    typeof content_type !== "string"
  ) {
    return null;
  }
  return {
    id,
    title,
    source,
    content_type,
    url: typeof raw["url"] === "string" ? raw["url"] : null,
    description:
      typeof raw["description"] === "string" && raw["description"].length > 0
        ? raw["description"]
        : null,
    discovered_at:
      typeof raw["discovered_at"] === "string" ? raw["discovered_at"] : null,
    provenance: isRecord(raw["provenance"]) ? (raw["provenance"] as UnknownRecord) : {},
  };
}

function softFailureOf(envelope: UnknownRecord): {
  status: string | null;
  warnings: string[];
} | null {
  if (envelope["ok"] !== false) return null;
  const warnings = Array.isArray(envelope["warnings"])
    ? envelope["warnings"].filter((w): w is string => typeof w === "string")
    : [];
  return {
    status: typeof envelope["status"] === "string" ? envelope["status"] : null,
    warnings,
  };
}

/** GET /api/discovery/status envelope (as `unknown`) → renderable state. */
export function parseDiscoveryStatus(body: unknown): DiscoveryStatus {
  const empty: DiscoveryStatus = {
    sources: [],
    interests: [],
    skippedRows: 0,
    softFailure: null,
  };
  if (!isRecord(body)) return empty;
  const failure = softFailureOf(body);
  if (failure) return { ...empty, softFailure: failure };

  const data = envelopeData(body);
  if (!isRecord(data)) return empty;

  const sourcesRaw = Array.isArray(data["sources"]) ? data["sources"] : [];
  const interestsRaw = Array.isArray(data["interests"]) ? data["interests"] : [];
  let skipped = 0;
  const sources: DiscoverySourceRow[] = [];
  const interests: DiscoveryInterestRow[] = [];
  for (const raw of sourcesRaw) {
    const row = parseSource(raw);
    if (row) sources.push(row);
    else skipped += 1;
  }
  for (const raw of interestsRaw) {
    const row = parseInterest(raw);
    if (row) interests.push(row);
    else skipped += 1;
  }
  return { sources, interests, skippedRows: skipped, softFailure: null };
}

/** GET /api/discovery/discover envelope (as `unknown`) → this check's finds. */
export function parseDiscoverRun(body: unknown): DiscoverRun {
  const empty: DiscoverRun = {
    items: [],
    count: 0,
    sourcesQueried: 0,
    skippedRows: 0,
    softFailure: null,
  };
  if (!isRecord(body)) return empty;
  const failure = softFailureOf(body);
  if (failure) return { ...empty, softFailure: failure };

  const data = envelopeData(body);
  if (!isRecord(data)) return empty;

  const itemsRaw = Array.isArray(data["items"]) ? data["items"] : [];
  let skipped = 0;
  const items: DiscoveryFinding[] = [];
  for (const raw of itemsRaw) {
    const row = parseFinding(raw);
    if (row) items.push(row);
    else skipped += 1;
  }
  return {
    items,
    count: typeof data["count"] === "number" ? data["count"] : items.length,
    sourcesQueried:
      typeof data["sources_queried"] === "number" ? data["sources_queried"] : 0,
    skippedRows: skipped,
    softFailure: null,
  };
}

// ─── Provenance words (D16 capture-mode discipline) ──────────────────

/**
 * Capture-mode note: what happened to this item, in one sentence. The
 * vendored engine saves new finds into the world's own bounded capture
 * window (discovery/world_run.py); it pushes nothing to a channel
 * unless one was configured — and the station never configures one.
 * (The rest of the provenance line — source, kinds, timestamp — is
 * composed around the finding in Interests.tsx, where <time> markup
 * belongs.)
 */
export function captureModeNote(finding: DiscoveryFinding): string {
  return typeof finding.provenance["engine"] === "string"
    ? "Captured by the engine into this world's own check window — nothing was pushed anywhere."
    : "The source reported this item directly; the engine recorded no capture provenance for it.";
}

/** "2 findings" / "1 finding" — words, not badges. */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
