import { useState, useCallback } from "react";
import {
  usePrincipal,
  useDiscoveryStatus,
  useDiscoverySources,
  useDiscoveryInterests,
  useDiscoveryDiscover,
} from "../lib/hooks";
import "./interests-screen.css";

interface Source {
  id: string;
  name: string;
  url: string;
  tags: string[];
}

interface Interest {
  id: string;
  name: string;
  category: string;
  weight: number;
}

interface DiscoveredItem {
  id: string;
  title: string;
  url: string;
  source: string;
  provenance?: string;
  summary?: string;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("pw_token") || "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export default function InterestsScreen() {
  const principal = usePrincipal();
  const name =
    principal.data && !principal.isError
      ? String(principal.data.display_name || "").trim() || null
      : null;

  const status = useDiscoveryStatus();
  const sourcesQuery = useDiscoverySources();
  const interestsQuery = useDiscoveryInterests();
  const discoverQuery = useDiscoveryDiscover();

  const [sourceForm, setSourceForm] = useState({ name: "", url: "", tags: "" });
  const [interestForm, setInterestForm] = useState({
    name: "",
    category: "",
    weight: "1",
  });
  const [addSourceError, setAddSourceError] = useState<string | null>(null);
  const [addInterestError, setAddInterestError] = useState<string | null>(null);
  const [discoverSource, setDiscoverSource] = useState<string>("");
  const discoverWithSource = useDiscoveryDiscover(discoverSource || undefined);

  const sources: Source[] =
    (sourcesQuery.data as any)?.data?.sources ??
    (sourcesQuery.data as any)?.sources ??
    [];
  const interests: Interest[] =
    (interestsQuery.data as any)?.data?.interests ??
    (interestsQuery.data as any)?.interests ??
    [];
  const discoveredItems: DiscoveredItem[] =
    (discoverWithSource.data as any)?.data?.items ??
    (discoverWithSource.data as any)?.items ??
    (discoverQuery.data as any)?.data?.items ??
    (discoverQuery.data as any)?.items ??
    [];

  const statusData = (status.data as any)?.data ?? (status.data as any) ?? {};
  const sourcesCount = statusData.sources_count ?? sources.length;
  const interestsCount = statusData.interests_count ?? interests.length;
  const itemsCount = statusData.items_count ?? discoveredItems.length;

  const addSource = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setAddSourceError(null);
      const id = `src-${Date.now()}`;
      const tags = sourceForm.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      try {
        const res = await fetch("/api/discovery/sources", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            id,
            name: sourceForm.name,
            url: sourceForm.url,
            tags,
          }),
        });
        const json = await res.json();
        if (json.ok) {
          setSourceForm({ name: "", url: "", tags: "" });
          sourcesQuery.refetch();
          status.refetch();
        } else {
          setAddSourceError(json.error || "Failed to add source");
        }
      } catch {
        setAddSourceError("Network error");
      }
    },
    [sourceForm, sourcesQuery, status]
  );

  const addInterest = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setAddInterestError(null);
      const id = `int-${Date.now()}`;
      const weight = parseFloat(interestForm.weight) || 1;
      try {
        const res = await fetch("/api/discovery/interests", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            id,
            name: interestForm.name,
            category: interestForm.category,
            weight,
          }),
        });
        const json = await res.json();
        if (json.ok) {
          setInterestForm({ name: "", category: "", weight: "1" });
          interestsQuery.refetch();
          status.refetch();
        } else {
          setAddInterestError(json.error || "Failed to add interest");
        }
      } catch {
        setAddInterestError("Network error");
      }
    },
    [interestForm, interestsQuery, status]
  );

  const runDiscovery = useCallback(() => {
    discoverWithSource.refetch();
  }, [discoverWithSource]);

  return (
    <div className="pw-interests">
      <div className="pw-interests-header">
        <h1 className="pw-interests-title">Interests</h1>
        <p className="pw-interests-subtitle">
          {name ? `${name}'s` : "Your"} discovery room
        </p>
      </div>

      {/* Status bar */}
      <section className="pw-interests-status" aria-label="Discovery status">
        <div className="pw-interests-status-grid">
          <div className="pw-interests-status-card">
            <span className="pw-interests-status-count">{sourcesCount}</span>
            <span className="pw-interests-status-label">Sources</span>
          </div>
          <div className="pw-interests-status-card">
            <span className="pw-interests-status-count">{interestsCount}</span>
            <span className="pw-interests-status-label">Interests</span>
          </div>
          <div className="pw-interests-status-card">
            <span className="pw-interests-status-count">{itemsCount}</span>
            <span className="pw-interests-status-label">Items</span>
          </div>
        </div>
        {status.isLoading && (
          <p className="pw-interests-hint">Loading status…</p>
        )}
      </section>

      {/* Discovery sources */}
      <section
        className="pw-interests-sources"
        aria-label="Discovery sources"
      >
        <h2 className="pw-interests-section-title">Sources</h2>
        {sourcesQuery.isLoading ? (
          <p className="pw-interests-hint">Loading sources…</p>
        ) : sources.length > 0 ? (
          <ul className="pw-interests-source-list">
            {sources.map((source) => (
              <li key={source.id} className="pw-interests-source">
                <span className="pw-interests-source-name">{source.name}</span>
                <span className="pw-interests-source-url">{source.url}</span>
                {source.tags?.length > 0 && (
                  <span className="pw-interests-source-tags">
                    {source.tags.join(", ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="pw-interests-empty">
            No discovery sources configured yet.
          </p>
        )}

        <form className="pw-interests-form" onSubmit={addSource}>
          <h3 className="pw-interests-form-label">Add source</h3>
          <div className="pw-interests-form-row">
            <input
              className="pw-interests-input"
              type="text"
              placeholder="Name"
              value={sourceForm.name}
              onChange={(e) =>
                setSourceForm((f) => ({ ...f, name: e.target.value }))
              }
              required
            />
            <input
              className="pw-interests-input"
              type="url"
              placeholder="https://…"
              value={sourceForm.url}
              onChange={(e) =>
                setSourceForm((f) => ({ ...f, url: e.target.value }))
              }
              required
            />
            <input
              className="pw-interests-input"
              type="text"
              placeholder="Tags (comma-separated)"
              value={sourceForm.tags}
              onChange={(e) =>
                setSourceForm((f) => ({ ...f, tags: e.target.value }))
              }
            />
            <button className="pw-interests-button" type="submit">
              Add
            </button>
          </div>
          {addSourceError && (
            <p className="pw-interests-error">{addSourceError}</p>
          )}
        </form>
      </section>

      {/* Interests */}
      <section className="pw-interests-interests" aria-label="Your interests">
        <h2 className="pw-interests-section-title">Interests</h2>
        {interestsQuery.isLoading ? (
          <p className="pw-interests-hint">Loading interests…</p>
        ) : interests.length > 0 ? (
          <ul className="pw-interests-interest-list">
            {interests.map((interest) => (
              <li key={interest.id} className="pw-interests-interest">
                <span className="pw-interests-interest-name">
                  {interest.name}
                </span>
                {interest.category && (
                  <span className="pw-interests-interest-category">
                    {interest.category}
                  </span>
                )}
                <span className="pw-interests-interest-weight">
                  weight {interest.weight}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pw-interests-empty">No interests added yet.</p>
        )}

        <form className="pw-interests-form" onSubmit={addInterest}>
          <h3 className="pw-interests-form-label">Add interest</h3>
          <div className="pw-interests-form-row">
            <input
              className="pw-interests-input"
              type="text"
              placeholder="Name"
              value={interestForm.name}
              onChange={(e) =>
                setInterestForm((f) => ({ ...f, name: e.target.value }))
              }
              required
            />
            <input
              className="pw-interests-input"
              type="text"
              placeholder="Category"
              value={interestForm.category}
              onChange={(e) =>
                setInterestForm((f) => ({ ...f, category: e.target.value }))
              }
            />
            <input
              className="pw-interests-input pw-interests-input--small"
              type="number"
              placeholder="Weight"
              min="0"
              max="10"
              step="0.1"
              value={interestForm.weight}
              onChange={(e) =>
                setInterestForm((f) => ({ ...f, weight: e.target.value }))
              }
            />
            <button className="pw-interests-button" type="submit">
              Add
            </button>
          </div>
          {addInterestError && (
            <p className="pw-interests-error">{addInterestError}</p>
          )}
        </form>
      </section>

      {/* Discovered content */}
      <section
        className="pw-interests-discovered"
        aria-label="Discovered content"
      >
        <h2 className="pw-interests-section-title">Discovered</h2>
        <div className="pw-interests-discover-controls">
          <select
            className="pw-interests-select"
            value={discoverSource}
            onChange={(e) => setDiscoverSource(e.target.value)}
          >
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            className="pw-interests-button"
            type="button"
            onClick={runDiscovery}
            disabled={discoverWithSource.isLoading}
          >
            {discoverWithSource.isLoading ? "Discovering…" : "Run discovery"}
          </button>
        </div>

        {discoverWithSource.isLoading && discoveredItems.length === 0 ? (
          <p className="pw-interests-hint">Running discovery…</p>
        ) : discoveredItems.length > 0 ? (
          <ul className="pw-interests-item-list">
            {discoveredItems.map((item) => (
              <li key={item.id} className="pw-interests-item">
                <a
                  href={item.url}
                  className="pw-interests-item-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="pw-interests-item-title">{item.title}</span>
                  <span className="pw-interests-item-source">
                    {item.source}
                  </span>
                </a>
                {item.provenance && (
                  <p className="pw-interests-item-provenance">
                    {item.provenance}
                  </p>
                )}
                {item.summary && (
                  <p className="pw-interests-item-summary">{item.summary}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="pw-interests-empty-state">
            <p className="pw-interests-empty-title">
              This room is still empty.
            </p>
            <p className="pw-interests-empty-body">
              It has been keeping the light on for you. Add discovery sources
              and interests to start exploring.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
