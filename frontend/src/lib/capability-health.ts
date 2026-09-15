/**
 * Capability health as Today presents it.
 *
 * The canonical status vocabulary lives in
 * `src/personal_world/status.py`; this helper only classifies what the
 * server already computed — no health logic is invented here.
 *
 * Providers are optional by default, so the states mean different things
 * to the person:
 *
 *   healthy          — working
 *   not_configured   — off by choice; QUIET (nothing to do until wanted)
 *   disabled         — deliberately off; QUIET
 *   unknown          — nobody has looked; calm, never assumed OK
 *   unavailable      — configured but not reachable; ONE calm sentence
 *   stale            — a dated observation; calm, never an alarm
 *   needs_attention  — genuinely wants the person
 *   warning          — genuinely wants the person
 *
 * Only `needs_attention` / `warning` (plus unrecognised status strings,
 * which must never be silently promoted to healthy) count as "needs you".
 *
 * The provider-owned `ok` boolean is deliberately NOT the decision
 * input: it is inconsistent across providers (some report `ok: true`
 * while `status` is `not_configured`; others `ok: false` for the same
 * state). Status is the canonical field.
 */

export type CapabilityState = {
  ok?: boolean;
  status?: string;
  warnings?: string[];
  last_observed?: string;
};

export const CAPABILITY_ATTENTION_STATUSES = [
  "needs_attention",
  "warning",
] as const;
export const CAPABILITY_UNAVAILABLE_STATUSES = ["unavailable", "stale"] as const;
export const CAPABILITY_QUIET_STATUSES = [
  "healthy",
  "not_configured",
  "disabled",
  "unknown",
] as const;

const ATTENTION = new Set<string>(CAPABILITY_ATTENTION_STATUSES);
const UNAVAILABLE = new Set<string>(CAPABILITY_UNAVAILABLE_STATUSES);
const QUIET = new Set<string>(CAPABILITY_QUIET_STATUSES);

export interface CapabilityHealth {
  total: number;
  healthy: number;
  /** Configured and reachable but wanting the person. */
  attention: string[];
  /** Configured but unreachable/dated — calm mention, never an alarm. */
  unavailable: string[];
  /** Healthy, off by choice, or never observed. Quiet by default. */
  quiet: string[];
  /** Off by choice (not_configured / disabled). */
  optional: number;
  /** Unrecognised status strings, surfaced as attention (never assumed OK). */
  unknownStatuses: string[];
  /** Capabilities that are not off by choice — the meter's denominator. */
  configured: number;
  /** 0–4 filled stars: the healthy fraction of configured capabilities. */
  meter: number;
}

export function summarizeCapabilities(
  caps: Record<string, CapabilityState> | null | undefined
): CapabilityHealth {
  const entries = Object.entries(caps || {});
  const attention: string[] = [];
  const unavailable: string[] = [];
  const quiet: string[] = [];
  const unknownStatuses: string[] = [];
  let healthy = 0;
  let optional = 0;

  for (const [name, cap] of entries) {
    const status = (cap?.status ?? "").trim();
    if (status === "healthy") {
      healthy += 1;
      quiet.push(name);
    } else if (ATTENTION.has(status)) {
      attention.push(name);
    } else if (UNAVAILABLE.has(status)) {
      unavailable.push(name);
    } else if (QUIET.has(status)) {
      quiet.push(name);
      if (status === "not_configured" || status === "disabled") optional += 1;
    } else {
      // A status we don't recognise is honest UNKNOWN, not healthy.
      unknownStatuses.push(status || "(missing)");
      attention.push(name);
    }
  }

  const total = entries.length;
  const configured = total - optional;
  // Nothing configured is not a failure — show the calm full meter.
  const meter =
    configured > 0 ? Math.round((4 * healthy) / configured) : 4;

  return {
    total,
    healthy,
    attention,
    unavailable,
    quiet,
    optional,
    unknownStatuses,
    configured,
    meter,
  };
}