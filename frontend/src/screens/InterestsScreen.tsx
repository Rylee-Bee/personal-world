import { useState, useEffect } from "react";
import { usePrincipal } from "../lib/hooks";
import "./interests-screen.css";

/**
 * InterestsScreen — Workshop v3, frame 17:1515
 * "Interests unexplored room"
 *
 * Built from canonical Figma evidence. AMBIENT register.
 * Shell mode: sidebar (256px)
 *
 * "This room is still empty. It has been keeping the light on for you."
 */

export default function InterestsScreen() {
  const principal = usePrincipal();
  const name =
    principal.data && !principal.isError
      ? String(principal.data.display_name || "").trim() || null
      : null;

  const [sources, setSources] = useState<any[]>([]);
  const [interests, setInterests] = useState<any[]>([]);
  const [discoveredItems, setDiscoveredItems] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("pw_token") || "";
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch("/api/discovery/sources", { headers }).then((r) => r.json()),
      fetch("/api/discovery/interests", { headers }).then((r) => r.json()),
      fetch("/api/discovery/discover", { headers }).then((r) => r.json()),
    ])
      .then(([sourcesData, interestsData, discoverData]) => {
        if (sourcesData.ok) setSources(sourcesData.data?.sources || []);
        if (interestsData.ok) setInterests(interestsData.data?.interests || []);
        if (discoverData.ok) setDiscoveredItems(discoverData.data?.items || []);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="pw-interests">
      <div className="pw-interests-header">
        <h1 className="pw-interests-title">Interests</h1>
        <p className="pw-interests-subtitle">
          {name ? `${name}'s` : "Your"} discovery room
        </p>
      </div>

      {/* Discovery sources */}
      <section className="pw-interests-sources" aria-label="Discovery sources">
        <h2 className="pw-interests-section-title">Sources</h2>
        {sources.length > 0 ? (
          <ul className="pw-interests-source-list">
            {sources.map((source: any) => (
              <li key={source.id} className="pw-interests-source">
                <span className="pw-interests-source-name">{source.name}</span>
                <span className="pw-interests-source-type">{source.source_type}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pw-interests-empty">
            No discovery sources configured yet.
          </p>
        )}
      </section>

      {/* Interests */}
      <section className="pw-interests-interests" aria-label="Your interests">
        <h2 className="pw-interests-section-title">Interests</h2>
        {interests.length > 0 ? (
          <ul className="pw-interests-interest-list">
            {interests.map((interest: any) => (
              <li key={interest.id} className="pw-interests-interest">
                <span className="pw-interests-interest-name">{interest.name}</span>
                {interest.category && (
                  <span className="pw-interests-interest-category">{interest.category}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="pw-interests-empty">
            No interests added yet.
          </p>
        )}
      </section>

      {/* Discovered content */}
      <section className="pw-interests-discovered" aria-label="Discovered content">
        <h2 className="pw-interests-section-title">Discovered</h2>
        {discoveredItems.length > 0 ? (
          <ul className="pw-interests-item-list">
            {discoveredItems.map((item: any) => (
              <li key={item.id} className="pw-interests-item">
                <a href={item.url} className="pw-interests-item-link" target="_blank" rel="noopener noreferrer">
                  <span className="pw-interests-item-title">{item.title}</span>
                  <span className="pw-interests-item-source">{item.source}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="pw-interests-empty-state">
            <p className="pw-interests-empty-title">
              This room is still empty.
            </p>
            <p className="pw-interests-empty-body">
              It has been keeping the light on for you. Add discovery sources and interests to start exploring.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
