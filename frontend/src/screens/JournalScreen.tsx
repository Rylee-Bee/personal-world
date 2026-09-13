import { useState } from "react";
import {
  usePrincipal,
  useJournal,
  useJournalPage,
  useJournalAudit,
  useMemorySearch,
  useJournalKey,
} from "../lib/hooks";
import type { JournalEntry } from "../lib/api";
import "./journal-screen.css";

function formatTime(ts: string): string {
  const date = new Date(ts);
  if (!ts || Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function entryText(entry: JournalEntry): string {
  return (entry as unknown as Record<string, string>).text ?? entry.summary ?? "";
}

function EntryItem({ entry }: { entry: JournalEntry }) {
  return (
    <li className="pw-journal-entry">
      <time dateTime={entry.ts} className="pw-journal-entry-time">
        {formatTime(entry.ts)}
      </time>
      <p className="pw-journal-entry-text">{entryText(entry)}</p>
    </li>
  );
}

export default function JournalScreen() {
  const principal = usePrincipal();
  const name =
    principal.data && !principal.isError
      ? String(principal.data.display_name || "").trim() || null
      : null;

  const journal = useJournal();
  const history = useJournalPage(50);
  const audit = useJournalAudit();
  const journalKey = useJournalKey();

  const [writeText, setWriteText] = useState("");
  const [writeStatus, setWriteStatus] = useState<string | null>(null);
  const [writePending, setWritePending] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const memorySearch = useMemorySearch(searchQuery);

  async function handleWrite(e: React.FormEvent) {
    e.preventDefault();
    const text = writeText.trim();
    if (!text) return;
    setWritePending(true);
    setWriteStatus(null);
    try {
      const token = localStorage.getItem("pw_token") || "";
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-PW-StepUp": "1",
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? `Write failed (${res.status})`);
      }
      setWriteText("");
      setWriteStatus("Saved.");
      journalKey();
    } catch (err) {
      setWriteStatus(err instanceof Error ? err.message : "Write failed.");
    } finally {
      setWritePending(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchInput.trim();
    if (q) setSearchQuery(q);
  }

  const entries: JournalEntry[] = Array.isArray(journal.data) ? journal.data : [];

  return (
    <div className="pw-journal">
      <section className="pw-journal-header" aria-labelledby="journal-heading">
        <h1 id="journal-heading" className="pw-journal-title">
          Journal
        </h1>
        <p className="pw-journal-subtitle">
          {name ? `${name}'s` : "Your"} quiet writing space.
        </p>
      </section>

      <section className="pw-journal-page" aria-labelledby="journal-write-heading">
        <h2 id="journal-write-heading" className="sr-only">
          Write a journal entry
        </h2>
        <form className="pw-journal-write" onSubmit={handleWrite}>
          <label htmlFor="journal-write-input" className="sr-only">
            What's on your mind?
          </label>
          <textarea
            id="journal-write-input"
            className="pw-journal-write-input"
            placeholder="What's on your mind?"
            value={writeText}
            onChange={(e) => setWriteText(e.target.value)}
            rows={3}
            disabled={writePending}
          />
          <div className="pw-journal-write-actions">
            <button
              type="submit"
              className="pw-journal-write-submit"
              disabled={writePending || !writeText.trim()}
            >
              {writePending ? "Writing\u2026" : "Write"}
            </button>
            {writeStatus && (
              <span className="pw-journal-write-status" role="status">
                {writeStatus}
              </span>
            )}
          </div>
        </form>
      </section>

      <div className="pw-journal-page" aria-labelledby="journal-entries-heading">
        <h2 id="journal-entries-heading" className="sr-only">
          Recent journal entries
        </h2>
        {journal.isLoading ? (
          <p className="pw-journal-status" role="status">
            Opening your journal\u2026
          </p>
        ) : entries.length === 0 ? (
          <div className="pw-journal-empty" role="status">
            <span className="pw-journal-empty-sparkle" aria-hidden="true">
              \u2726
            </span>
            <p className="pw-journal-empty-text">
              Your journal is quiet. Write when you're ready.
            </p>
          </div>
        ) : (
          <ul className="pw-journal-list" role="list">
            {entries.map((entry, i) => (
              <EntryItem key={`${entry.ts}-${i}`} entry={entry} />
            ))}
          </ul>
        )}
      </div>

      <details className="pw-journal-page pw-journal-disclosure">
        <summary className="pw-journal-disclosure-summary">
          Journal history
        </summary>
        {history.isLoading ? (
          <p className="pw-journal-status" role="status">
            Loading history\u2026
          </p>
        ) : !Array.isArray(history.data) || history.data.length === 0 ? (
          <p className="pw-journal-status">No history yet.</p>
        ) : (
          <ul className="pw-journal-list" role="list">
            {history.data.map((entry, i) => (
              <EntryItem key={`${entry.ts}-hist-${i}`} entry={entry} />
            ))}
          </ul>
        )}
      </details>

      <details className="pw-journal-page pw-journal-disclosure">
        <summary className="pw-journal-disclosure-summary">
          Audit trail
        </summary>
        {audit.isLoading ? (
          <p className="pw-journal-status" role="status">
            Loading audit trail\u2026
          </p>
        ) : audit.data?.text ? (
          <pre className="pw-journal-audit-text">{audit.data.text}</pre>
        ) : (
          <p className="pw-journal-status">No audit data.</p>
        )}
      </details>

      <section className="pw-journal-page" aria-labelledby="journal-search-heading">
        <h2 id="journal-search-heading" className="sr-only">
          Memory search
        </h2>
        <form className="pw-journal-search" onSubmit={handleSearch}>
          <label htmlFor="journal-search-input" className="sr-only">
            Search memories
          </label>
          <input
            id="journal-search-input"
            type="text"
            className="pw-journal-search-input"
            placeholder="Search memories\u2026"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button
            type="submit"
            className="pw-journal-search-submit"
            disabled={!searchInput.trim()}
          >
            Search
          </button>
        </form>
        {searchQuery && memorySearch.isLoading && (
          <p className="pw-journal-status" role="status">
            Searching\u2026
          </p>
        )}
        {searchQuery && !memorySearch.isLoading && memorySearch.data != null && (
          <div className="pw-journal-search-results">
            {Array.isArray(memorySearch.data) && memorySearch.data.length === 0 ? (
              <p className="pw-journal-status">No results.</p>
            ) : Array.isArray(memorySearch.data) ? (
              <ul className="pw-journal-list" role="list">
                {memorySearch.data.map((item: Record<string, unknown>, i: number) => (
                  <li key={i} className="pw-journal-entry">
                    <p className="pw-journal-entry-text">
                      {String(
                        item.text ?? item.summary ?? JSON.stringify(item)
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <pre className="pw-journal-audit-text">
                {JSON.stringify(memorySearch.data, null, 2)}
              </pre>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
