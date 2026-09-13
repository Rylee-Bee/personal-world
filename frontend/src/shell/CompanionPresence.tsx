/**
 * CompanionPresence — Workshop v3 sidebar mode
 *
 * The companion inhabitant at the bottom of the sidebar.
 * Shows the companion artwork with "quietly here" presence.
 */

export function CompanionPresence() {
  return (
    <div className="pw-companion-presence">
      <div className="pw-companion-portrait" aria-hidden="true">
        <img src="/companions/mermaid.svg" alt="" />
      </div>
      <p className="pw-companion-label">✦ quietly here</p>
    </div>
  );
}
