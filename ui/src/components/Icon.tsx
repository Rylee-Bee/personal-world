/**
 * Icon — one glyph from the Worlds icon library (design/assets/icons),
 * drawn from the shared sprite in the text colour.
 *
 * Icons never carry meaning alone (accessibility contract): they are
 * always decorative here (aria-hidden) and sit beside visible words or
 * inside a control that has its own accessible name.
 */
import { ICON_IDS, type IconName } from "../generated/icons";

export type { IconName };

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  /** 16, 20 or 24 px (the library's tested sizes). */
  size?: 16 | 20 | 24 | 32;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className ?? ""}`}
    >
      <use href={`/assets/icons/sprite.svg#${ICON_IDS[name]}`} />
    </svg>
  );
}
