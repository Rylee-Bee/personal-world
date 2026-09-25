/**
 * Starter crew for the Rooms section (Doorways, owner direction B,
 * 2026-09-25).
 *
 * Presentation only. Companions never report status or decide anything:
 * the room reports, and the words say what is true. This map is the
 * STARTER crew, not a fixed cast — the owner wants people to add their
 * own companions and choose which rooms (if any) they keep. Until the
 * crew registry exists (GET /api/crew, keepers per room), this small map
 * is the whole assignment, keyed by the room's own id.
 *
 * Art lives in public/assets/crew/{256,512} (web sizes of the masters in
 * design/assets/crew/). Paths join against import.meta.env.BASE_URL so a
 * path-prefixed deploy still finds them (the /vnext/ lesson, see
 * ResidentPresence).
 */

export interface StarterKeeper {
  /** Display name (owner canon, docs/COMPANION-CANON.md). */
  name: string;
  /** File stem under assets/crew/256/. */
  portrait: string;
}

const KEEPERS: Record<string, StarterKeeper> = {
  workshop: { name: "Bolt", portrait: "bolt-portrait" },
  "play-nice": { name: "Hekek", portrait: "hekek-portrait" },
  vefr: { name: "Ratatoskr", portrait: "ratatoskr-portrait" },
  memomancer: { name: "Bruma", portrait: "bruma-portrait" },
};

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

function crewAsset(size: 256 | 512, stem: string): string {
  return `${import.meta.env.BASE_URL}assets/crew/${size}/${stem}.webp`;
}

export function starterKeeper(roomId: string): StarterKeeper | null {
  return KEEPERS[roomKey(roomId)] ?? null;
}

export function keeperPortraitUrl(keeper: StarterKeeper): string {
  return crewAsset(256, keeper.portrait);
}

export function interiorUrl(roomId: string): string | null {
  const stem = INTERIORS[roomKey(roomId)];
  return stem ? crewAsset(512, stem) : null;
}
