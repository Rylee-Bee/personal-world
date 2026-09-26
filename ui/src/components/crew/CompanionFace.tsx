/**
 * CompanionFace — a companion's picture, or, when they have none, the
 * crew commbadge (Sol's ringed planet, the badge every crew member wears)
 * with their initial on it (owner, 2026-09-26).
 *
 * Always decorative (aria-hidden, alt=""): the companion's name is in
 * words beside it wherever it appears. A picture that fails to load
 * falls back to the badge rather than a broken image.
 */
import { useState } from "react";

const BADGE = `${import.meta.env.BASE_URL}assets/crew/256/sol-badge.webp`;

const SIZES = {
  sm: { box: "h-10 w-10", text: "text-[13px]" },
  md: { box: "h-[72px] w-[72px]", text: "text-[22px]" },
  lg: { box: "h-20 w-20", text: "text-[24px]" },
} as const;

export function CompanionFace({
  name,
  initial,
  portrait,
  size = "md",
  dim = false,
}: {
  name: string;
  /** Server-computed initial when there is one (crew.initial_of). */
  initial?: string;
  portrait?: string;
  size?: keyof typeof SIZES;
  dim?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const letter = (initial || name.trim().charAt(0) || "✦").toUpperCase();
  const s = SIZES[size];
  const showPortrait = portrait !== undefined && failed !== portrait;

  return (
    <span
      aria-hidden="true"
      className={`relative flex ${s.box} shrink-0 items-center justify-center overflow-hidden rounded-[var(--pw-radius-full)] ${
        showPortrait ? "border-2 border-[var(--pw-accent-warm)] bg-[var(--pw-surface-hull)]" : ""
      } ${dim ? "opacity-60 saturate-50" : ""}`}
    >
      {showPortrait ? (
        <img
          src={portrait}
          alt=""
          onError={() => setFailed(portrait)}
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          <img src={BADGE} alt="" className="h-full w-full object-contain" />
          {/* On the badge's navy planet; cream on navy is well past 7:1. */}
          <span
            className={`absolute inset-0 flex items-center justify-center font-semibold ${s.text} text-[#ECE4D6]`}
            style={{ fontFamily: "var(--pw-typography-font_serif, inherit)" }}
          >
            {letter}
          </span>
        </>
      )}
    </span>
  );
}
