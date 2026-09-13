import { useState, useEffect } from "react";
import { usePrincipal } from "../lib/hooks";
import "./journal-screen.css";

interface JournalEntry {
  text: string;
  ts: string;
}

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

export default function JournalScreen() {
  const principal = usePrincipal();
  const name =
    principal.data && !principal.isError
      ? String(principal.data.display_name || "").trim() || null
      : null;

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/journal", {
      headers: { Authorization: `Bearer ${localStorage.getItem("pw_token") || ""}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setEntries(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

      <div className="pw-journal-page" aria-labelledby="journal-entries-heading">
        <h2 id="journal-entries-heading" className="sr-only">
          Journal entries
        </h2>

        {loading ? (
          <p className="pw-journal-status" role="status">
            Opening your journal…
          </p>
        ) : entries.length === 0 ? (
          <div className="pw-journal-empty" role="status">
            <span className="pw-journal-empty-sparkle" aria-hidden="true">✦</span>
            <p className="pw-journal-empty-text">
              Your journal is quiet. Write when you're ready.
            </p>
          </div>
        ) : (
          <ul className="pw-journal-list" role="list">
            {entries.map((entry, i) => (
              <li key={`${entry.ts}-${i}`} className="pw-journal-entry">
                <time dateTime={entry.ts} className="pw-journal-entry-time">
                  {formatTime(entry.ts)}
                </time>
                <p className="pw-journal-entry-text">{entry.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
