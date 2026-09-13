import { usePrincipal, useWorldStatus, useActors } from "../lib/hooks";
import "./world-screen.css";

export default function WorldScreen() {
  const principal = usePrincipal();
  const worldStatus = useWorldStatus();
  const actors = useActors();

  const worldName =
    principal.data && !principal.isError
      ? String(principal.data.display_name || "").trim() || "Your World"
      : "Your World";

  const worldData = worldStatus.data;
  const capabilities = worldData?.capabilities || {};
  const capCount = Object.keys(capabilities).length;
  const healthyCaps = Object.values(capabilities).filter((c: any) => c.ok).length;

  const actorList = actors.data || [];
  const healthyActors = actorList.filter((a: any) => a.status === "healthy").length;

  return (
    <div className="pw-world">
      <section className="pw-world-header" aria-labelledby="world-heading">
        <div className="pw-world-orb" aria-hidden="true">
          <div className="pw-world-orb-glow" />
          <div className="pw-world-orb-ring" />
        </div>
        <div className="pw-world-header-copy">
          <p className="pw-world-eyebrow">Personal World</p>
          <h1 id="world-heading" className="pw-world-title">
            {worldName}
          </h1>
          <p className="pw-world-subtitle">
            Everything here belongs to you.
          </p>
          <p className="pw-world-watch-note">
            <span aria-hidden="true">✦</span> keeping watch over all of this
          </p>
        </div>
      </section>

      <div className="pw-world-strip" role="status" aria-label="World status">
        <div className="pw-world-strip-item">
          <span className="pw-world-strip-dot" aria-hidden="true" />
          <p className="pw-world-strip-label">World active</p>
        </div>
        <div className="pw-world-strip-divider" aria-hidden="true" />
        <div className="pw-world-strip-item">
          <span className="pw-world-strip-dot" aria-hidden="true" />
          <p className="pw-world-strip-label">
            {healthyCaps}/{capCount} capabilities healthy
          </p>
        </div>
        <div className="pw-world-strip-divider" aria-hidden="true" />
        <div className="pw-world-strip-item">
          <span className="pw-world-strip-dot" aria-hidden="true" />
          <p className="pw-world-strip-label">
            {healthyActors} provider{healthyActors === 1 ? "" : "s"} connected
          </p>
        </div>
      </div>

      <section className="pw-world-companion" aria-label="Companion presence">
        <div className="pw-world-companion-art" aria-hidden="true">
          <div className="pw-world-companion-figure" />
          <span className="pw-world-companion-bubble" />
          <span className="pw-world-companion-bubble pw-world-companion-bubble--small" />
          <span className="pw-world-companion-sparkle" />
        </div>
        <div className="pw-world-companion-copy">
          <p className="pw-world-companion-name">The Mermaid</p>
          <p className="pw-world-companion-body">
            She keeps watch over your world — sensing what changes, what
            needs attention, and what can stay quiet. Present and aware,
            always.
          </p>
          <div className="pw-world-companion-presence">
            <span className="pw-world-companion-presence-dot" aria-hidden="true" />
            <p className="pw-world-companion-presence-label">Present — watching</p>
          </div>
        </div>
      </section>
    </div>
  );
}
