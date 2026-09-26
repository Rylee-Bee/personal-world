/**
 * Words and small helpers shared by the Rooms panel and the room drawer.
 * Status is always a word here (accessibility contract §1.3).
 */
import type { RoomRow } from "../../data/contract";

/** The six honest words a room row can carry. `unreachable` and
 *  `incompatible` are the front door's own words: a room that did not
 *  answer, and one whose contract this front door does not support. */
export const STATUS_WORDS: Record<string, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  unhealthy: "Unhealthy",
  unknown: "Unknown",
  unreachable: "Unreachable",
  incompatible: "Incompatible",
};

export function statusWord(raw: string): string {
  return STATUS_WORDS[raw] ?? "Unknown";
}

export function formatTime(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "an unknown time";
  return when.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function roomName(row: RoomRow): string {
  return row.room?.name?.trim() || row.id;
}

export function initial(row: RoomRow): string {
  return roomName(row).charAt(0).toUpperCase() || "✦";
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}


/** "4 min ago", "3 hours ago", "yesterday", else the date; honest about
 *  an unparseable time. `now` comes from the caller's clock. */
export function relativeTime(iso: string | null | undefined, now: number): string {
  if (!iso) return "at an unknown time";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "at an unknown time";
  const mins = Math.round((now - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${plural(hours, "hour", "hours")} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return formatTime(iso);
}

export const LINK_BASE =
  "inline-flex min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] items-center justify-center rounded-[var(--pw-radius-sm)] px-[var(--pw-spacing-lg)] text-[length:var(--pw-typography-size_small)] font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]";

const TONE_WORDS: Record<string, string> = {
  good_news: "Good news",
  update: "A small update",
  when_ready: "When you’re ready",
};

/** room/0: an unknown or missing tone is treated as `update`. */
export function toneWord(tone: string | null | undefined): string {
  return TONE_WORDS[tone ?? ""] ?? TONE_WORDS.update;
}

/** The room whose drawer shows Secrets (the backend reads the station
 *  through it). */
export const SECRETS_ROOM_ID = "workshop";

/**
 * Where a person's browser reaches a room: its registry `public_url` when
 * that's a usable http(s) address, else `base_url` (which may only work
 * from the station itself).
 */
export function roomAddress(row: RoomRow): string {
  const pub = row.public_url;
  if (typeof pub === "string") {
    try {
      const u = new URL(pub);
      if ((u.protocol === "http:" || u.protocol === "https:") && !u.username && !u.password) return pub;
    } catch {
      // fall through to base_url
    }
  }
  return row.base_url;
}

/**
 * A path on a site, made absolute against that site's address — only a
 * same-origin path (starts with "/", not "//", no scheme). Anything else
 * is refused, never followed.
 */
export function sitePathUrl(address: string, link: string | null | undefined): string | null {
  if (typeof link !== "string" || !link.startsWith("/") || link.startsWith("//")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(link) || link.includes("\\")) return null;
  try {
    const base = new URL(address);
    if (base.protocol !== "http:" && base.protocol !== "https:") return null;
    const url = new URL(link, base.origin);
    return url.origin === base.origin ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * A room's link to one item, made absolute against the room's own
 * address — only when the room sent a same-origin path (starts with "/",
 * not "//", no scheme). Anything else is refused, never followed.
 */
export function roomItemUrl(row: RoomRow, link: string | null | undefined): string | null {
  return sitePathUrl(roomAddress(row), link);
}

