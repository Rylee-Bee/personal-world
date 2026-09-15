import { describe, expect, it } from "vitest";
import {
  summarizeCapabilities,
  type CapabilityState,
} from "../lib/capability-health";

/*
 * Capability-health truth contract (mirrors src/personal_world/status.py):
 * - only needs_attention / warning count as "needs you"
 * - not_configured / disabled are off by choice → quiet, never alarm
 * - unavailable / stale earn one calm mention, not attention
 * - an unrecognised status is never silently promoted to healthy
 * - the meter reflects the healthy fraction of configured capabilities
 */

function caps(
  entries: Record<string, string>
): Record<string, CapabilityState> {
  return Object.fromEntries(
    Object.entries(entries).map(([name, status]) => [name, { status }])
  );
}

describe("summarizeCapabilities", () => {
  it("counts only needs_attention/warning as attention", () => {
    const s = summarizeCapabilities(
      caps({
        a: "healthy",
        b: "not_configured",
        c: "unavailable",
        d: "needs_attention",
        e: "warning",
        f: "stale",
        g: "unknown",
        h: "disabled",
      })
    );
    expect(s.attention.sort()).toEqual(["d", "e"]);
    expect(s.unavailable.sort()).toEqual(["c", "f"]);
    expect(s.healthy).toBe(1);
    expect(s.optional).toBe(2); // not_configured + disabled
    expect(s.total).toBe(8);
  });

  it("treats an empty map as calm, not broken", () => {
    const s = summarizeCapabilities({});
    expect(s.total).toBe(0);
    expect(s.attention).toEqual([]);
    expect(s.unavailable).toEqual([]);
    expect(s.meter).toBe(4);
  });

  it("never promotes an unrecognised status to healthy", () => {
    const s = summarizeCapabilities(caps({ weird: "exploded" }));
    expect(s.healthy).toBe(0);
    expect(s.attention).toEqual(["weird"]);
    expect(s.unknownStatuses).toEqual(["exploded"]);
  });

  it("treats a missing status as unknown, not healthy", () => {
    const s = summarizeCapabilities({ a: { ok: true } });
    expect(s.healthy).toBe(0);
    expect(s.attention).toEqual(["a"]);
    expect(s.unknownStatuses).toEqual(["(missing)"]);
  });

  it("meter reflects the healthy fraction of configured capabilities", () => {
    // 3 healthy of 4 configured (one unavailable) → 3/4
    const s = summarizeCapabilities(
      caps({
        a: "healthy",
        b: "healthy",
        c: "healthy",
        d: "unavailable",
        e: "not_configured",
        f: "not_configured",
      })
    );
    expect(s.configured).toBe(4);
    expect(s.meter).toBe(3);
  });

  it("meter is empty when configured capabilities are all failing", () => {
    const s = summarizeCapabilities(caps({ a: "unavailable", b: "needs_attention" }));
    expect(s.meter).toBe(0);
  });

  it("ignores the provider-owned ok flag for the attention decision", () => {
    // The server can report ok:true while status is not_configured (and
    // ok:false for the same state). Status is canonical.
    const s = summarizeCapabilities({
      a: { ok: true, status: "not_configured" },
      b: { ok: false, status: "not_configured" },
    });
    expect(s.attention).toEqual([]);
    expect(s.optional).toBe(2);
  });

  it("tolerates null/undefined capability maps", () => {
    expect(summarizeCapabilities(null).total).toBe(0);
    expect(summarizeCapabilities(undefined).total).toBe(0);
  });
});