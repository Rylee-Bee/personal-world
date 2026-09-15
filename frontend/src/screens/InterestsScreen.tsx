import { useState, useCallback } from "react";
import {
  usePrincipal,
  useDiscoveryStatus,
  useDiscoverySources,
  useDiscoveryInterests,
  useDiscoveryDiscover,
} from "../lib/hooks";
import { CompanionSlot } from "../primitives/CompanionSlot";
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

  const isEmpty = sources.length === 0 && interests.length === 0;

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

  if (isEmpty) {
    return (
      <div className="pw-interests">
        <div className="pw-interests-ambient" aria-hidden="true" />

        <div className="pw-interests-doorway" aria-hidden="true">
          <div className="pw-interests-doorway-glow" />
        </div>

        <div className="pw-interests-motes" aria-hidden="true">
          <span className="pw-interests-mote pw-interests-mote--1" />
          <span className="pw-interests-mote pw-interests-mote--2" />
          <span className="pw-interests-mote pw-interests-mote--3" />
          <span className="pw-interests-mote pw-interests-mote--4" />
          <span className="pw-interests-mote pw-interests-mote--5" />
          <span className="pw-interests-mote pw-interests-mote--6" />
        </div>

        <div className="pw-interests-scene">
          <div className="pw-interests-empty-room">
            <div className="pw-interests-illustration">
              <div className="pw-interests-aura" />
              <CompanionSlot size="empty" />
              <span className="pw-interests-sparkle" aria-hidden="true">&#10022;</span>
            </div>

            <div className="pw-interests-message">
              <div className="pw-interests-title-row">
                <span className="pw-interests-bookmark" aria-hidden="true">&#9670;</span>
                <h1 className="pw-interests-title">Interests</h1>
              </div>
              <h2 className="pw-interests-subtitle">This room is still empty.</h2>
              <p className="pw-interests-empty-accent">
                It has been keeping the light on for you.
              </p>
              <p className="pw-interests-hint">
                Interests helps your world learn what you care about &mdash; bookmarks,
                saved articles, and things you want to explore later.
              </p>
              <a href="#start-exploring" className="pw-interests-cta">
                Start exploring &rarr;
              </a>
            </div>

            <div className="pw-interests-divider" />

            <p className="pw-interests-footer-hint">
              <span className="pw-interests-footer-icon" aria-hidden="true" />
              An empty shelf. What will you put here?
            </p>
          </div>
        </div>

        {/* Collapsible setup for when user wants to start */}
        <details className="pw-interests-setup" id="start-exploring">
          <summary className="pw-interests-setup-summary">
            Configure discovery sources
          </summary>
          <div className="pw-interests-setup-body">
            <InterestsForms
              sources={sources}
              interests={interests}
              sourceForm={sourceForm}
              setSourceForm={setSourceForm}
              interestForm={interestForm}
              setInterestForm={setInterestForm}
              addSourceError={addSourceError}
              addInterestError={addInterestError}
              addSource={addSource}
              addInterest={addInterest}
            />
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="pw-interests pw-interests--populated">
      <div className="pw-interests-ambient" aria-hidden="true" />

      <div className="pw-interests-doorway pw-interests-doorway--subtle" aria-hidden="true">
        <div className="pw-interests-doorway-glow" />
      </div>

      <div className="pw-interests-motes pw-interests-motes--populated" aria-hidden="true">
        <span className="pw-interests-mote pw-interests-mote--1" />
        <span className="pw-interests-mote pw-interests-mote--4" />
        <span className="pw-interests-mote pw-interests-mote--6" />
      </div>

      <header className="pw-interests-populated-header">
        <div className="pw-interests-title-row">
          <span className="pw-interests-bookmark" aria-hidden="true">&#9670;</span>
          <h1 className="pw-interests-title">Interests</h1>
        </div>
        <p className="pw-interests-populated-subtitle">
          {name ? `${name}'s` : "Your"} discovery room
        </p>
      </header>

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
      </section>

      <section className="pw-interests-content" aria-label="Discovery sources">
        <h2 className="pw-interests-section-title">Sources</h2>
        {sourcesQuery.isLoading ? (
          <p className="pw-interests-hint">Loading sources&hellip;</p>
        ) : sources.length > 0 ? (
          <ul className="pw-interests-list">
            {sources.map((source) => (
              <li key={source.id} className="pw-interests-list-item">
                <span className="pw-interests-list-item-name">{source.name}</span>
                <span className="pw-interests-list-item-meta">{source.url}</span>
                {source.tags?.length > 0 && (
                  <span className="pw-interests-list-item-tag">
                    {source.tags.join(", ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="pw-interests-hint">Your world is ready to learn what you care about. Add a source to begin.</p>
        )}
      </section>

      <section className="pw-interests-content" aria-label="Your interests">
        <h2 className="pw-interests-section-title">Interests</h2>
        {interestsQuery.isLoading ? (
          <p className="pw-interests-hint">Loading interests&hellip;</p>
        ) : interests.length > 0 ? (
          <ul className="pw-interests-list">
            {interests.map((interest) => (
              <li key={interest.id} className="pw-interests-list-item">
                <span className="pw-interests-list-item-name">{interest.name}</span>
                {interest.category && (
                  <span className="pw-interests-list-item-tag">{interest.category}</span>
                )}
                <span className="pw-interests-list-item-meta">
                  weight {interest.weight}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pw-interests-hint">Tell your world what interests you — it will keep watch.</p>
        )}
      </section>

      <section className="pw-interests-content" aria-label="Discovered content">
        <h2 className="pw-interests-section-title">Discovered</h2>
        <div className="pw-interests-discover-controls">
          <select
            className="pw-interests-select"
            value={discoverSource}
            onChange={(e) => setDiscoverSource(e.target.value)}
          >
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            className="pw-interests-button"
            type="button"
            onClick={runDiscovery}
            disabled={discoverWithSource.isLoading}
          >
            {discoverWithSource.isLoading ? "Discovering\u2026" : "Run discovery"}
          </button>
        </div>
        {discoveredItems.length > 0 ? (
          <ul className="pw-interests-list">
            {discoveredItems.map((item) => (
              <li key={item.id} className="pw-interests-list-item">
                <a href={item.url} className="pw-interests-list-item-link" target="_blank" rel="noopener noreferrer">
                  <span className="pw-interests-list-item-name">{item.title}</span>
                  <span className="pw-interests-list-item-meta">{item.source}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pw-interests-hint">
            {discoverWithSource.isLoading ? "Running discovery\u2026" : "No items discovered yet."}
          </p>
        )}
      </section>

      <div className="pw-interests-companion" aria-hidden="true">
        <CompanionSlot size="empty" />
        <span className="pw-interests-companion-label">quietly nearby</span>
      </div>
    </div>
  );
}

function InterestsForms({
  sourceForm,
  setSourceForm,
  interestForm,
  setInterestForm,
  addSourceError,
  addInterestError,
  addSource,
  addInterest,
}: {
  sources: Source[];
  interests: Interest[];
  sourceForm: { name: string; url: string; tags: string };
  setSourceForm: (f: { name: string; url: string; tags: string }) => void;
  interestForm: { name: string; category: string; weight: string };
  setInterestForm: (f: { name: string; category: string; weight: string }) => void;
  addSourceError: string | null;
  addInterestError: string | null;
  addSource: (e: React.FormEvent) => void;
  addInterest: (e: React.FormEvent) => void;
}) {
  return (
    <>
      <form className="pw-interests-form" onSubmit={addSource}>
        <h3 className="pw-interests-form-label">Add source</h3>
        <div className="pw-interests-form-row">
          <input className="pw-interests-input" type="text" placeholder="Name" value={sourceForm.name} onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })} required />
          <input className="pw-interests-input" type="url" placeholder="https://\u2026" value={sourceForm.url} onChange={(e) => setSourceForm({ ...sourceForm, url: e.target.value })} required />
          <input className="pw-interests-input" type="text" placeholder="Tags (comma-separated)" value={sourceForm.tags} onChange={(e) => setSourceForm({ ...sourceForm, tags: e.target.value })} />
          <button className="pw-interests-button" type="submit">Add</button>
        </div>
        {addSourceError && <p className="pw-interests-error">{addSourceError}</p>}
      </form>

      <form className="pw-interests-form" onSubmit={addInterest}>
        <h3 className="pw-interests-form-label">Add interest</h3>
        <div className="pw-interests-form-row">
          <input className="pw-interests-input" type="text" placeholder="Name" value={interestForm.name} onChange={(e) => setInterestForm({ ...interestForm, name: e.target.value })} required />
          <input className="pw-interests-input" type="text" placeholder="Category" value={interestForm.category} onChange={(e) => setInterestForm({ ...interestForm, category: e.target.value })} />
          <input className="pw-interests-input pw-interests-input--small" type="number" placeholder="Weight" min="0" max="10" step="0.1" value={interestForm.weight} onChange={(e) => setInterestForm({ ...interestForm, weight: e.target.value })} />
          <button className="pw-interests-button" type="submit">Add</button>
        </div>
        {addInterestError && <p className="pw-interests-error">{addInterestError}</p>}
      </form>
    </>
  );
}
