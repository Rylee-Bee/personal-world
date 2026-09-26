/**
 * ResidentPresence — Swappable resident presentation container.
 *
 * Uses actual character artwork from the repo's asset collection when
 * the resident has any. Artwork is decorative when the same info is
 * conveyed in text (a11y contract §7.2) — so a resident WITHOUT art
 * gets an honest initial-letter medallion instead: never a
 * broken-image glyph, and never someone else's art standing in as a
 * fake (PRODUCT-LANGUAGE.md principle 3: no invented presence).
 */

import { useState } from "react";
import type { Resident } from "../data/types";

interface ResidentPresenceProps {
  resident: Resident;
  size?: "sm" | "md" | "lg";
}

/**
 * public/ files are copied verbatim into the build, so Vite's
 * build-time base rewriting (index.html hrefs, CSS url()) never
 * reaches runtime JS strings — a hard-coded "/assets/…" 404s when the
 * app is served under a path prefix (PW_VITE_BASE=/vnext/, the
 * Station's side-by-side mount). Joining against import.meta.env
 * .BASE_URL resolves the whole class: BASE_URL is "/" for the
 * default build and always carries its trailing slash otherwise.
 */
function publicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}

// Map resident IDs to their artwork under public/assets/characters/.
const ARTWORK_MAP: Record<string, string> = {
  assistant: "/assets/crew/assistant.svg",
  renai: "/assets/characters/renai.png",
  bolt: "/assets/characters/bolt.png",
  burrito: "/assets/characters/burrito.png",
  scoop: "/assets/characters/burrito.png",
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

const medallionTextSize = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
};

export function ResidentPresence({
  resident,
  size = "md",
}: ResidentPresenceProps) {
  const direct = resident.artwork?.trim();
  const mapped = ARTWORK_MAP[resident.id];
  const src = direct ? direct : mapped ? publicAsset(mapped) : undefined;
  // Remember the src that failed, not just "something failed": a
  // later, different src still gets its chance, while the same dead
  // one cannot loop the medallion back into an <img>.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showArt = src !== undefined && failedSrc !== src;
  const initial = resident.name.trim().charAt(0).toUpperCase() || "✦";

  return (
    <div className="flex items-center gap-[var(--pw-spacing-lg)]">
      <div
        className={`${sizeMap[size]} shrink-0 overflow-hidden rounded-full bg-[var(--pw-surface-hull)] border border-[var(--pw-border-subtle)] flex items-center justify-center`}
      >
        {showArt ? (
          <img
            src={src}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
            onError={() => setFailedSrc(src)}
          />
        ) : (
          /* Decorative like the art it replaces — the resident's name
           * is right there in text beside it. */
          <span
            aria-hidden="true"
            className={`${medallionTextSize[size]} font-semibold text-[var(--pw-accent-primary)] leading-none select-none`}
          >
            {initial}
          </span>
        )}
      </div>
      <div>
        <p className="font-medium text-[var(--pw-text-primary)]">
          {resident.name}
        </p>
        {resident.role && (
          <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
            {resident.role}
          </p>
        )}
      </div>
    </div>
  );
}
