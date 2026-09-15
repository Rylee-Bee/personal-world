/**
 * WorldIdentity — Workshop v3 sidebar mode
 *
 * The world's mark and name. Canonical identity: ✦ project worlds.
 */

export function WorldIdentity() {
  return (
    <div className="pw-world-identity">
      <div className="pw-world-mark" aria-hidden="true">
        <img src="/companions/personal-world.svg" alt="" />
      </div>
      <div className="pw-world-name-group">
        <p className="pw-world-label">&#10022; project worlds</p>
      </div>
    </div>
  );
}
