/**
 * Room art for the Doorways theme (owner direction B, 2026-09-25).
 *
 * Presentation only. Who keeps a room is not decided here: keepers are
 * the person's own choice and arrive on each row from the server
 * (`GET /api/rooms` → `keeper`). This module knows two things:
 *
 *   - the interiors drawn for specific rooms (Workshop, Play-Nice, …);
 *   - the doorway LIBRARY (owner, 2026-09-26): twelve interiors anyone
 *     can choose for any room. Nothing is assigned automatically (owner:
 *     "no need to set defaults"); a room with neither shows the plain
 *     lantern arch.
 *
 * A chosen doorway wins over a room's drawn interior. The choice lives
 * on this device (rooms/doorwayChoice.ts), like the theme.
 *
 * Art lives in public/assets/crew/512 (web sizes of the masters in
 * design/assets/crew/ and design/assets/library/). Paths join against
 * import.meta.env.BASE_URL so a path-prefixed deploy still finds them.
 */
import type { RoomKeeper } from "../../data/contract";
import { crewAssetUrl } from "../../data/types";

/** Room interiors drawn for specific rooms (file stems under 512/). */
const INTERIORS: Record<string, string> = {
  worlds: "room-worlds",
  workshop: "workshop-doorway",
  "play-nice": "play-nice-doorway",
  vefr: "vefr-doorway",
  memomancer: "memomancer-doorway",
};

/** The doorway library, in the order the picker offers it. */
export const DOORWAYS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "study", label: "Study" },
  { id: "archive", label: "Archive" },
  { id: "garden", label: "Garden" },
  { id: "kitchen", label: "Kitchen" },
  { id: "lounge", label: "Lounge" },
  { id: "music", label: "Music room" },
  { id: "observatory", label: "Observatory" },
  { id: "post", label: "Post office" },
  { id: "travel", label: "Map room" },
  { id: "vault", label: "Vault" },
  { id: "wellness", label: "Infirmary" },
  { id: "hallway", label: "Hallway" },
];

const DOORWAY_IDS = new Set(DOORWAYS.map((d) => d.id));

/** Normalise a room id or name to the map's keys ("Play-Nice", "playnice"). */
function roomKey(id: string): string {
  const k = id.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return k === "playnice" ? "play-nice" : k;
}

function asset(size: 256 | 512, stem: string): string {
  return `${import.meta.env.BASE_URL}assets/crew/${size}/${stem}.webp`;
}

export function isDoorwayId(id: unknown): id is string {
  return typeof id === "string" && DOORWAY_IDS.has(id);
}

export function doorwayUrl(doorwayId: string, size: 256 | 512 = 512): string {
  return asset(size, `doorway-${doorwayId}`);
}

/** The room's own drawn interior, if it has one. */
export function drawnInteriorUrl(roomId: string): string | null {
  const stem = INTERIORS[roomKey(roomId)];
  return stem ? asset(512, stem) : null;
}

/** What a room shows: the doorway chosen for it, else its own drawn
 *  interior, else nothing (the plain arch). */
export function interiorUrl(roomId: string, chosen?: string | null): string | null {
  if (isDoorwayId(chosen)) return doorwayUrl(chosen);
  return drawnInteriorUrl(roomId);
}

/** A keeper's picture, or undefined when they have none (they wear the
 *  crew commbadge with their initial instead). */
export function keeperPortraitUrl(keeper: RoomKeeper): string | undefined {
  return crewAssetUrl(keeper.portrait_url);
}

/** The portrait library (owner, 2026-09-26): faces anyone can give a
 *  companion they add. `suggested` is only a starting name. */
export const PORTRAIT_PICKS: ReadonlyArray<{ id: string; label: string; suggested: string }> = [
  { id: "owl", label: "Owl", suggested: "Ori" },
  { id: "fox", label: "Fox", suggested: "Fenn" },
  { id: "moth", label: "Moth", suggested: "Lumi" },
  { id: "robot", label: "Robot", suggested: "Pip" },
  { id: "lighthouse-keeper", label: "Lighthouse keeper", suggested: "Mara" },
  { id: "cloud", label: "Cloud", suggested: "Nimbus" },
  { id: "hedgehog", label: "Hedgehog", suggested: "Thimble" },
  { id: "octopus", label: "Octopus", suggested: "Kora" },
  { id: "gardener", label: "Gardener", suggested: "Ivy" },
  { id: "cartographer", label: "Cartographer", suggested: "Soren" },
  { id: "red-panda", label: "Red panda", suggested: "Tavi" },
  { id: "axolotl", label: "Axolotl", suggested: "Aster" },
  { id: "mossling", label: "Mossling", suggested: "Fern" },
  { id: "starfish-alien", label: "Starfish alien", suggested: "Coral" },
  { id: "crystal-alien", label: "Crystal alien", suggested: "Prism" },
  { id: "mushroom-alien", label: "Mushroom alien", suggested: "Miko" },
];

export function pickUrl(pickId: string, size: 256 | 512 = 256): string {
  return asset(size, `pick-${pickId}`);
}
