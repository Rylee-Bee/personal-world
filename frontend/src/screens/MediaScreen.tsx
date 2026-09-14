import { useState, useCallback } from "react";
import {
  useMediaStatus,
  useMediaLibrary,
  useMediaRecent,
  useMediaActivity,
} from "../lib/hooks";
import { EmptyState } from "../shell/EmptyState";
import "./media-screen.css";

interface MediaItem {
  id: string;
  title: string;
  kind: string;
  year?: number | null;
  poster_url?: string | null;
  provider: string;
  availability: string;
  status: string;
  progress?: number | null;
  added_at?: string | null;
  watched_at?: string | null;
}

interface MediaLibraryEntry {
  id: string;
  name: string;
  kind: string;
  item_count: number;
  provider: string;
}

interface MediaActivityEntry {
  id: string;
  title: string;
  kind: string;
  status: string;
  progress?: number | null;
  eta?: string | null;
  provider: string;
}

function providerIcon(provider: string): string {
  switch (provider) {
    case "plex": return "P";
    case "sonarr": return "S";
    case "radarr": return "R";
    case "lidarr": return "L";
    default: return provider.charAt(0).toUpperCase();
  }
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "movie": return "Movie";
    case "series": return "Series";
    case "episode": return "Episode";
    case "album": return "Album";
    default: return kind;
  }
}

function activityStatusLabel(status: string): string {
  switch (status) {
    case "downloading": return "Downloading";
    case "queued": return "Queued";
    case "completed": return "Completed";
    case "failed": return "Failed";
    default: return status;
  }
}

export default function MediaScreen() {
  const status = useMediaStatus();
  const library = useMediaLibrary();
  const recent = useMediaRecent();
  const activity = useMediaActivity();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MediaItem[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;
      setSearchLoading(true);
      try {
        const token = localStorage.getItem("pw_token") || "";
        const res = await fetch(
          `/api/media/search?q=${encodeURIComponent(searchQuery)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const json = await res.json();
        setSearchResults(json?.data?.items ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [searchQuery]
  );

  const statusData = (status.data as any)?.data ?? status.data ?? {};
  const providers: Array<{ name: string; provider: string; ok: boolean; status: string }> =
    statusData.providers ?? [];
  const summary = statusData.summary ?? { total: 0, healthy: 0, unavailable: 0 };

  const libraries: MediaLibraryEntry[] =
    (library.data as any)?.data?.libraries ??
    (library.data as any)?.libraries ??
    [];

  const recentItems: MediaItem[] =
    (recent.data as any)?.data?.items ??
    (recent.data as any)?.items ??
    [];

  const activities: MediaActivityEntry[] =
    (activity.data as any)?.data?.activities ??
    (activity.data as any)?.activities ??
    [];

  const hasProviders = summary.total > 0;
  const isConfigured =
    status.data !== undefined &&
    (status.data as any)?.status !== "not_configured";

  if (!status.isLoading && !isConfigured && !hasProviders) {
    return (
      <EmptyState
        title="Media"
        headingLevel={1}
        capability="Media gathers your movies, shows, and music from Plex, Sonarr, Radarr, and Lidarr."
        knob="Add a media connection in Settings → Connections to enable this section."
        status="not_configured"
      />
    );
  }

  return (
    <div className="pw-media">
      <div className="pw-media-header">
        <h1 className="pw-media-title">Media</h1>
        <p className="pw-media-subtitle">Your library, activity, and discoveries</p>
      </div>

      {/* Status bar */}
      <section className="pw-media-status" aria-label="Media provider status">
        {status.isLoading ? (
          <p className="pw-media-hint">Loading status…</p>
        ) : (
          <div className="pw-media-status-grid">
            <div className="pw-media-status-card">
              <span className="pw-media-status-count">{summary.total}</span>
              <span className="pw-media-status-label">Providers</span>
            </div>
            <div className="pw-media-status-card pw-media-status-card--healthy">
              <span className="pw-media-status-count">{summary.healthy}</span>
              <span className="pw-media-status-label">Healthy</span>
            </div>
            {summary.unavailable > 0 && (
              <div className="pw-media-status-card pw-media-status-card--warn">
                <span className="pw-media-status-count">{summary.unavailable}</span>
                <span className="pw-media-status-label">Unavailable</span>
              </div>
            )}
            {providers.map((p) => (
              <div
                key={p.name}
                className={`pw-media-status-card ${p.ok ? "" : "pw-media-status-card--warn"}`}
              >
                <span className="pw-media-status-provider-icon">{providerIcon(p.provider)}</span>
                <span className="pw-media-status-label">{p.name}</span>
                <span className={`pw-media-status-dot ${p.ok ? "pw-media-status-dot--ok" : "pw-media-status-dot--fail"}`} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Search */}
      <section className="pw-media-search" aria-label="Search media">
        <form className="pw-media-search-form" onSubmit={handleSearch}>
          <input
            className="pw-media-search-input"
            type="text"
            placeholder="Search movies, shows, albums…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            className="pw-media-button"
            type="submit"
            disabled={searchLoading || !searchQuery.trim()}
          >
            {searchLoading ? "Searching…" : "Search"}
          </button>
        </form>
        {searchResults !== null && (
          <div className="pw-media-search-results">
            {searchResults.length > 0 ? (
              <ul className="pw-media-item-list">
                {searchResults.map((item) => (
                  <li key={item.id} className="pw-media-item">
                    <span className="pw-media-item-kind">{kindLabel(item.kind)}</span>
                    <span className="pw-media-item-title">{item.title}</span>
                    {item.year && <span className="pw-media-item-year">{item.year}</span>}
                    <span className="pw-media-item-provider">{item.provider}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pw-media-hint">No results found for "{searchQuery}".</p>
            )}
          </div>
        )}
      </section>

      {/* Continue watching / Recently available */}
      <section className="pw-media-recent" aria-label="Recently added">
        <h2 className="pw-media-section-title">Recently Added</h2>
        {recent.isLoading ? (
          <p className="pw-media-hint">Loading recently added…</p>
        ) : recentItems.length > 0 ? (
          <ul className="pw-media-item-list">
            {recentItems.map((item) => (
              <li key={item.id} className="pw-media-item">
                <span className="pw-media-item-kind">{kindLabel(item.kind)}</span>
                <span className="pw-media-item-title">{item.title}</span>
                {item.year && <span className="pw-media-item-year">{item.year}</span>}
                <span className="pw-media-item-provider">{item.provider}</span>
                <span
                  className={`pw-media-item-availability pw-media-item-availability--${item.availability}`}
                >
                  {item.availability}
                </span>
                {item.progress != null && (
                  <div className="pw-media-progress">
                    <div
                      className="pw-media-progress-bar"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="pw-media-empty">No recently added items.</p>
        )}
      </section>

      {/* Activity / Queue */}
      <section className="pw-media-activity" aria-label="Activity queue">
        <h2 className="pw-media-section-title">Activity</h2>
        {activity.isLoading ? (
          <p className="pw-media-hint">Loading activity…</p>
        ) : activities.length > 0 ? (
          <ul className="pw-media-item-list">
            {activities.map((a) => (
              <li key={a.id} className="pw-media-item pw-media-item--activity">
                <span className="pw-media-item-kind">{kindLabel(a.kind)}</span>
                <span className="pw-media-item-title">{a.title}</span>
                <span className={`pw-media-activity-status pw-media-activity-status--${a.status}`}>
                  {activityStatusLabel(a.status)}
                </span>
                <span className="pw-media-item-provider">{a.provider}</span>
                {a.progress != null && (
                  <div className="pw-media-progress">
                    <div
                      className="pw-media-progress-bar"
                      style={{ width: `${a.progress}%` }}
                    />
                  </div>
                )}
                {a.eta && <span className="pw-media-item-eta">{a.eta}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="pw-media-empty">No active downloads or queued items.</p>
        )}
      </section>

      {/* Library summary */}
      <section className="pw-media-library" aria-label="Library summary">
        <h2 className="pw-media-section-title">Library</h2>
        {library.isLoading ? (
          <p className="pw-media-hint">Loading library…</p>
        ) : libraries.length > 0 ? (
          <ul className="pw-media-library-list">
            {libraries.map((lib) => (
              <li key={lib.id} className="pw-media-library-entry">
                <span className="pw-media-library-name">{lib.name}</span>
                <span className="pw-media-library-kind">{lib.kind}</span>
                <span className="pw-media-library-count">{lib.item_count} items</span>
                <span className="pw-media-library-provider">{lib.provider}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pw-media-empty">No libraries found.</p>
        )}
      </section>
    </div>
  );
}
