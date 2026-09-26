/**
 * SpotArt — one of the painted spot icons (design/assets/icons/spot):
 * small gold-trimmed objects for empty states, section headers and cards.
 * The painted cousins of the line icons (owner rule: if we can add
 * whimsy, whimsy is an obligation).
 *
 * Always decoration beside words (alt="" and aria-hidden), never animated.
 */
export type SpotName =
  | "approve"
  | "candy"
  | "chat"
  | "crew"
  | "find"
  | "guest"
  | "helper"
  | "journal"
  | "limits"
  | "memory"
  | "people"
  | "quiet"
  | "room"
  | "secrets"
  | "settings"
  | "unreachable";

export function SpotArt({ name, size = 64, className = "" }: { name: SpotName; size?: number; className?: string }) {
  const base = `${import.meta.env.BASE_URL}assets/spot`;
  return (
    <img
      src={`${base}/${size > 128 ? 256 : 128}/spot-${name}.webp`}
      srcSet={`${base}/128/spot-${name}.webp 128w, ${base}/256/spot-${name}.webp 256w`}
      sizes={`${size}px`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      data-spot={name}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
