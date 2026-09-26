/**
 * SolMoment — Sol, the Worlds mark, in one of her moods (owner canon
 * 2026-09-25: she appears in menus, loading, empty states and little
 * moments all over).
 *
 * She is the logo, not a companion: she never speaks, so she is always
 * decoration beside Worlds' own words (alt="" and aria-hidden). Full
 * cutouts only, all framed alike so moods swap cleanly; never animated.
 *
 * hello · cheer (good news) · curious (keeping watch) · rest (quiet day)
 * searching (loading) · sleeping (can't reach) · proud (all done)
 * oops (something went wrong, nothing lost) · mark (the logo)
 */
export type SolMood =
  | "mark"
  | "hello"
  | "cheer"
  | "curious"
  | "rest"
  | "searching"
  | "sleeping"
  | "proud"
  | "oops";

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
