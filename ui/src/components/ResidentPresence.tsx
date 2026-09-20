/**
 * ResidentPresence — Swappable resident presentation container.
 *
 * Uses actual character artwork from the repo's asset collection.
 * Artwork is decorative when the same info is conveyed in text (a11y contract §7.2).
 */

import type { Resident } from "../data/types";

interface ResidentPresenceProps {
  resident: Resident;
  size?: "sm" | "md" | "lg";
}

// Map resident IDs to available artwork
const ARTWORK_MAP: Record<string, string> = {
  renai: "/assets/characters/renai.png",
  bolt: "/assets/characters/bolt.png",
  burrito: "/assets/characters/burrito.png",
  ratatoskr: "/assets/characters/ratatoskr.png",
  "personal-world": "/assets/characters/personal-world.png",
  solace: "/assets/characters/solace.png",
  bruma: "/assets/characters/bruma.png",
  hekek: "/assets/characters/hekek.png",
  mira: "/assets/characters/mira.png",
};

const sizeMap = {
  sm: "h-12 w-12",
  md: "h-20 w-20",
  lg: "h-32 w-32",
};

export function ResidentPresence({
  resident,
  size = "md",
}: ResidentPresenceProps) {
  const artworkSrc =
    resident.artwork || ARTWORK_MAP[resident.id] || "/assets/characters/renai.png";

  return (
    <div className="flex items-center gap-[var(--pw-spacing-lg)]">
      <div
        className={`${sizeMap[size]} shrink-0 overflow-hidden rounded-full bg-[var(--pw-surface-hull)] border border-[var(--pw-border-subtle)]`}
      >
        <img
          src={artworkSrc}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
        />
      </div>
      <div>
        <p className="font-medium text-[var(--pw-text-primary)]">
          {resident.name}
        </p>
        {resident.role && (
          <p className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
            {resident.role}
          </p>
        )}
      </div>
    </div>
  );
}
