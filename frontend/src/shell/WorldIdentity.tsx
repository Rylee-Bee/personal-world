import { usePrincipal } from "../lib/hooks";

/**
 * WorldIdentity — Workshop v3 sidebar mode
 *
 * The world's mark and name. Uses principal display_name from the API.
 * Never hardcodes the owner.
 */

export function WorldIdentity() {
  const principal = usePrincipal();
  const name =
    principal.data && !principal.isError
      ? String(principal.data.display_name || "").trim() || null
      : null;

  return (
    <div className="pw-world-identity">
      <div className="pw-world-mark" aria-hidden="true">
        <img src="/companions/personal-world.svg" alt="" />
      </div>
      <div className="pw-world-name-group">
        <p className="pw-world-label">Project</p>
        <p className="pw-world-name">{name ? `${name}'s world` : "Your world"}</p>
      </div>
    </div>
  );
}
