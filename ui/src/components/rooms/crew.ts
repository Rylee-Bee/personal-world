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
 *  companion they add, each with the owner's little crew story. `suggested`
 *  and `story` are only starting points: picking a face offers them as the
 *  companion's name and "few words", never over anything the person typed. */
export const PORTRAIT_PICKS: ReadonlyArray<{ id: string; label: string; suggested: string; story: string }> = [
  {
    id: "owl",
    label: "Owl",
    suggested: "Ori",
    story:
      "Ori once stayed awake cataloguing every constellation visible from the bridge. Now they keep a notebook of the ones people invent while looking out the window.",
  },
  {
    id: "fox",
    label: "Fox",
    suggested: "Fenn",
    story:
      "Fenn used to deliver parcels between faraway rooms. They still carry a satchel, though these days it’s usually full of snacks and things someone thought they’d lost.",
  },
  {
    id: "moth",
    label: "Moth",
    suggested: "Lumi",
    story:
      "Lumi learned to repair lamps so nobody had to find their way home in the dark. She likes the quiet moment when a room becomes warm again.",
  },
  {
    id: "robot",
    label: "Robot",
    suggested: "Pip",
    story:
      "Pip was assembled from spare workshop parts and given one task: fetch a screwdriver. They completed it perfectly, then decided to learn everyone’s favorite tea.",
  },
  {
    id: "lighthouse-keeper",
    label: "Lighthouse keeper",
    suggested: "Wren",
    story:
      "Wren tended a beacon on a lonely coast before joining the ship. She knows that a small, steady light can be enough to help someone find their way.",
  },
  {
    id: "cloud",
    label: "Cloud",
    suggested: "Nimbus",
    story:
      "Nimbus drifted aboard through an open observatory window and liked it here. They’re excellent company on quiet days and occasionally rain into their own teacup.",
  },
  {
    id: "hedgehog",
    label: "Hedgehog",
    suggested: "Thimble",
    story:
      "Thimble restores well-loved books, smoothing pages and sewing loose bindings. Their tiny toolkit is organized better than the entire workshop.",
  },
  {
    id: "octopus",
    label: "Octopus",
    suggested: "Kora",
    story:
      "Kora grew up in a floating harbor where every neighbor needed a hand. She can juggle eight projects, but has learned that asking for help feels pretty good too.",
  },
  {
    id: "gardener",
    label: "Gardener",
    suggested: "Ivy",
    story:
      "Ivy trades seedlings with every place the ship visits. Her greenhouse has a shelf for plants whose names nobody knows yet.",
  },
  {
    id: "cartographer",
    label: "Cartographer",
    suggested: "Soren",
    story:
      "Soren draws maps that include useful details like good benches, gentle routes, and where to get coffee. They believe a place isn’t fully mapped until someone feels welcome there.",
  },
  {
    id: "red-panda",
    label: "Red panda",
    suggested: "Tavi",
    story:
      "Tavi maintains the ship’s cozy corners. They can turn a forgotten alcove into a favorite reading spot with one lamp and a remarkably large blanket.",
  },
  {
    id: "axolotl",
    label: "Axolotl",
    suggested: "Aster",
    story:
      "Aster studies small repairs: cracked cups, torn sleeves, hurt feelings. They’re patient with all three and proudest when someone learns to mend something themselves.",
  },
  {
    id: "mossling",
    label: "Mossling",
    suggested: "Fern",
    story:
      "Fern sprouted in an old archive drawer beside a packet of seeds. They now care for the ship’s oldest plants and leave cheerful little leaf prints wherever they walk.",
  },
  {
    id: "starfish-alien",
    label: "Starfish alien",
    suggested: "Coral",
    story:
      "Coral comes from a world of tidal cities. They collect greetings from every language they encounter and practice them carefully before meeting someone new.",
  },
  {
    id: "crystal-alien",
    label: "Crystal alien",
    suggested: "Prism",
    story:
      "Prism used to measure starlight for a distant observatory. Their facets change color with the hour, which makes them an unexpectedly handy reminder to take a break.",
  },
  {
    id: "mushroom-alien",
    label: "Mushroom alien",
    suggested: "Miko",
    story:
      "Miko grew up in an underground village connected by shared meals and winding paths. They make wonderful soup and always leave a place at the table for one more.",
  },
];

export function pickUrl(pickId: string, size: 256 | 512 = 256): string {
  return asset(size, `pick-${pickId}`);
}
