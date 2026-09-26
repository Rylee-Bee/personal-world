/**
 * Room art for the Doorways theme (owner direction B, 2026-09-25).
 *
 * Presentation only. Who keeps a room is no longer decided here: keepers
 * are the person's own choice and arrive on each row from the server
 * (`GET /api/rooms` → `keeper`, set with `PUT /api/rooms/{id}/keeper`).
 * This module only knows which rooms have a drawn interior.
 *
 * Art lives in public/assets/crew/512 (web sizes of the masters in
 * design/assets/crew/). Paths join against import.meta.env.BASE_URL so a
 * path-prefixed deploy still finds them (the /vnext/ lesson, see
 * ResidentPresence).
 */
import type { RoomKeeper } from "../../data/contract";
import { crewAssetUrl } from "../../data/types";

/** Room interiors drawn for the Doorways theme (file stems under 512/). */
const INTERIORS: Record<string, string> = {
  worlds: "room-worlds",
  workshop: "workshop-doorway",
  "play-nice": "play-nice-doorway",
  vefr: "vefr-doorway",
  memomancer: "memomancer-doorway",
};

/** Normalise a room id or name to the map's keys ("Play-Nice", "playnice"). */
function roomKey(id: string): string {
  const k = id.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return k === "playnice" ? "play-nice" : k;
}

export function interiorUrl(roomId: string): string | null {
  const stem = INTERIORS[roomKey(roomId)];
  return stem ? `${import.meta.env.BASE_URL}assets/crew/512/${stem}.webp` : null;
}

/** A keeper's picture, or undefined when they have none (their initial
 *  shows in a lantern ring instead). */
export function keeperPortraitUrl(keeper: RoomKeeper): string | undefined {
  return crewAssetUrl(keeper.portrait_url);
}
