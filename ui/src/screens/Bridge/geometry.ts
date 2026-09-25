/**
 * Bridge — deterministic geometry and selection helpers.
 *
 * Pure, no React, no fetches: the star map's positions must be the
 * SAME on every render and every device (a person's world re-arranging
 * itself on each refresh is disorientation, not delight), and the
 * opening selection must be derivable from the briefing alone.
 *
 * Honesty floor: nothing here invents a system or a count. An absent
 * place stays absent; the fallback is the contract's own word.
 */

import type { BridgeData, BridgeSystemId } from "../../data/contract";
import { PERSONAL_AREAS, SKELETON_AREAS, type WorldAreaId } from "../../data/types";

export interface OrbitPoint {
  /** Percentage across the map, 0-100. */
  xPct: number;
  /** Percentage down the map, 0-100 (smaller is higher). */
  yPct: number;
}

/**
 * Place system `index` of `count` on a gentle arc: left → right, the
 * middle bodies riding higher. Deterministic in (index, count) alone —
 * no randomness, no viewport dependence — so the same world always
 * looks like itself.
 */
export function orbitPosition(index: number, count: number): OrbitPoint {
  const n = Math.max(count, 1);
  const t = n === 1 ? 0.5 : index / (n - 1); // 0..1
  const xPct = 10 + t * 80; // 10% .. 90%
  const yPct = 66 - Math.sin(t * Math.PI) * 36; // 30% at the crest, 66% at the ends
  return { xPct, yPct };
}

/**
 * The system the Bridge opens with: the stored place when it names a
 * system this briefing actually carries, else the system with the most
 * new arrivals, else "agents". Never a system the server did not send.
 */
export function chooseDefaultSystem(
  data: BridgeData,
  storedSystem: string | null,
): BridgeSystemId {
  if (
    storedSystem !== null &&
    data.systems.some((s) => s.id === storedSystem)
  ) {
    return storedSystem as BridgeSystemId;
  }
  let best: { id: BridgeSystemId; arrivals: number } | null = null;
  for (const system of data.systems) {
    const arrivals = system.counts?.arrivals ?? 0;
    if (arrivals > 0 && (best === null || arrivals > best.arrivals)) {
      best = { id: system.id, arrivals };
    }
  }
  return best?.id ?? "agents";
}

/** The known state-routed destinations a briefing link may name. */
const AREA_IDS: ReadonlySet<string> = new Set([
  ...SKELETON_AREAS.map((a) => a.id),
  ...PERSONAL_AREAS.map((a) => a.id),
]);

/** Narrow a briefing `link.area` to a destination this shell can open;
 *  an unknown area is not a door (never a fake href). */
export function knownArea(area: string | null): WorldAreaId | null {
  if (area !== null && AREA_IDS.has(area)) return area as WorldAreaId;
  return null;
}

/** How many tray items are beyond the three shown, honestly zero when
 *  the total fits. `have_tos` is capped at three by the contract, so
 *  the overflow is the difference, never a second query. */
export function trayOverflow(data: BridgeData): number {
  const shown = data.have_tos.length;
  return Math.max(data.have_tos_total - shown, 0);
}