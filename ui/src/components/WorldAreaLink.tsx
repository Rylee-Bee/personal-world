/**
 * WorldAreaLink — Navigation destination button.
 *
 * The shell is state-routed (no router exists), so a destination is
 * activated by a callback, never by an href: the old `/today`-style
 * URLs pointed at nothing the app serves. One activation path for
 * nav and for Overview's Explore tiles.
 *
 * Accessibility contract §2.2 (keyboard reachable) and §2.3 (no
 * hover required); the active destination is carried by
 * aria-current, not by colour alone.
 */

import type { WorldArea } from "../data/types";

interface WorldAreaLinkProps {
  area: WorldArea;
  isActive?: boolean;
  onClick: () => void;
}

export function WorldAreaLink({ area, isActive = false, onClick }: WorldAreaLinkProps) {
  const classes = [
    "flex items-center gap-[var(--pw-spacing-sm)] rounded-[var(--pw-radius-sm)] px-[var(--pw-spacing-lg)] py-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] font-medium",
    "min-h-[var(--pw-targets-minimum)]",
    "transition-colors duration-150 motion-reduce:transition-none",
    isActive
      ? "bg-[var(--pw-accent-warm_soft)] text-[var(--pw-accent-warm)]"
      : "text-[var(--pw-text-secondary)] hover:bg-[var(--pw-accent-teal_soft)] hover:text-[var(--pw-text-primary)]",
  ].join(" ");

  return (
    <button
      type="button"
      onClick={onClick}
      className={classes}
      aria-current={isActive ? "page" : undefined}
    >
      {area.label}
    </button>
  );
}
