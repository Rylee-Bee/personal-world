/**
 * CompanionPresence — Workshop v3 sidebar mode
 *
 * The companion inhabitant at the bottom of the sidebar.
 * Shows the companion artwork with "quietly here" presence.
 */

import { useCompanion, COMPANIONS } from "../lib/companion-context";

export function CompanionPresence() {
  const { companion } = useCompanion();
  const meta = COMPANIONS[companion];
  const icon = meta?.icon || "/companions/personal-world.svg";

  return (
    <div className="pw-companion-presence">
      <div className="pw-companion-portrait" aria-hidden="true">
        <img src={icon} alt="" />
      </div>
      <p className="pw-companion-label">✦ quietly here</p>
    </div>
  );
}
