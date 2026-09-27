/**
 * Every screen has an address (owner's walk-through, 2026-09-27: the URL
 * never changed, so back/forward and bookmarks didn't work). Worlds uses the
 * hash (`/#memory`, `/#library`) so no server route is needed; the path and
 * any query words (like `?room=`) are kept. Back and forward move between
 * screens. The Bridge is `#bridge`; Computers is `#computers`.
 */
export type AreaKey =
  | "overview" | "memory" | "chat" | "settings" | "interests" | "projects" | "systems"
  | "crew" | "people" | "helpers" | "rough-night" | "library" | "lore" | "at-home" | "stickers";

const SLUG: Record<AreaKey, string> = {
  overview: "bridge",
  memory: "memory",
  chat: "chat",
  settings: "settings",
  interests: "interests",
  projects: "projects",
  systems: "computers",
  crew: "crew",
  people: "people",
  helpers: "helpers",
  "rough-night": "rough-night",
  library: "library",
  lore: "lore",
  "at-home": "at-home",
  stickers: "stickers",
};
const BY_SLUG = new Map(Object.entries(SLUG).map(([area, slug]) => [slug, area as AreaKey]));

/** The address fragment for a screen, e.g. "#memory". */
export function hashFor(area: AreaKey): string {
  return `#${SLUG[area]}`;
}

/** The screen an address names, or null (an unknown or empty hash). */
export function areaFromHash(hash: string): AreaKey | null {
  const slug = decodeURIComponent(hash.replace(/^#\/?/, "")).trim().toLowerCase();
  return BY_SLUG.get(slug) ?? null;
}

/** Point the address at a screen: a new history entry, or a replacement. */
export function setAddress(area: AreaKey, mode: "push" | "replace"): void {
  const want = hashFor(area);
  if (window.location.hash === want) return;
  const url = `${window.location.pathname}${window.location.search}${want}`;
  try {
    if (mode === "push") window.history.pushState({ area }, "", url);
    else window.history.replaceState({ area }, "", url);
  } catch {
    /* an address we can't set is harmless: the screen still changed */
  }
}
