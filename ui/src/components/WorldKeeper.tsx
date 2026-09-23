/**
 * WorldKeeper — the one heartbeat (TRUE-NORTH; design/handoff/
 * WORLD_KEEPER.md).
 *
 * The globe greets, celebrates, sleeps — and is NEVER telemetry,
 * never a status badge (its founding rule, §7.1). The pose chosen
 * here depends only on the clock via keeperStateForHour; no
 * capability, health, or attention value may reach this component.
 *
 * Artwork: the existing companion art in public/assets/characters/
 * (deliberate artwork — never regenerated). The six semantic states
 * travel as `data-keeper-state` so a future pose pack or theme can
 * swap art per state; today the single canonical artwork renders
 * statically, with a calm luminance-only rest treatment for `sleep`
 * (no motion, no glow, no announcement — §7.5, §1.4).
 *
 * Accessibility: the artwork is aria-hidden decoration (§7.2); the
 * greet line beside it carries every word a screen reader needs.
 */

import type { KeeperState } from "../screens/Overview/home-loop";

interface WorldKeeperProps {
  state: KeeperState;
  /** WORLD_KEEPER.md size rules: 48px in the greeting area. */
  size?: "greeting" | "empty";
}

/** public/ files are copied verbatim; join against the deploy base
 *  exactly like ResidentPresence does (the /vnext/ lesson). */
function publicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}

const SIZE_CLASS = {
  greeting: "h-12 w-12",
  empty: "h-16 w-16",
} as const;

export function WorldKeeper({ state, size = "greeting" }: WorldKeeperProps) {
  const resting = state === "sleep";
  return (
    <span
      data-keeper-state={state}
      aria-hidden="true"
      role="presentation"
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--pw-accent-primary)]/30 bg-[var(--pw-accent-primary)]/10 ${SIZE_CLASS[size]}`}
    >
      <img
        src={publicAsset("/assets/characters/personal-world.png")}
        alt=""
        width={48}
        height={48}
        className={`h-full w-full rounded-full object-contain ${
          resting ? "opacity-70 saturate-50" : ""
        }`}
      />
    </span>
  );
}
