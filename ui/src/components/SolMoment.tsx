/**
 * SolMoment — Sol, the Worlds mark, in one of her moods (owner canon
 * 2026-09-25: she appears in menus, loading, empty states and little
 * moments all over).
 *
 * She is the logo, not a companion: she never speaks, so she is always
 * decoration beside Worlds' own words (alt="" and aria-hidden). Her full
 * cutouts only (never the peeking hello crop), and never animated.
 */
export type SolMood = "mark" | "cheer" | "curious" | "rest";

export function SolMoment({ mood, size = 56, className = "" }: { mood: SolMood; size?: number; className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}assets/crew/256/sol-${mood}.webp`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      data-sol-mood={mood}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
