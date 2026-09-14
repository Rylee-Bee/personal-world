import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useJournal,
  useJournalKey,
} from "../lib/hooks";
import {
  supersedeJournalEntry,
  fetchJournalHistory,
  fetchJournalPage,
  fetchJournalAudit,
  type JournalEntry,
} from "../lib/api";
import { takeCorrectionDraft, type CorrectionDraft } from "../lib/correction-draft";
import { CompanionSlot } from "../primitives/CompanionSlot";
import { Disclosure } from "../primitives/Disclosure";
import "./journal-screen.css";

function formatDate(ts: string): string {
  const date = new Date(ts);
  if (!ts || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function entryText(entry: JournalEntry): string {
  return (entry as unknown as Record<string, string>).text ?? entry.summary ?? "";
}

function entryTitle(entry: JournalEntry): string {
  const text = entryText(entry);
  if (!text) return "Untitled entry";
  const firstLine = text.split("\n")[0];
  return firstLine.length > 60 ? firstLine.slice(0, 57) + "..." : firstLine;
}

type JournalMode = "reading" | "writing";

type CorrectionState =
  | { phase: "closed" }
  | { phase: "proposed"; entry: JournalEntry; correctionText: string; reason: string; draftLabel: string | null }
  | { phase: "success"; entry: JournalEntry }
  | { phase: "failure"; entry: JournalEntry; warnings: string[] };

export default function JournalScreen() {
  const [searchParams] = useSearchParams();
  const correctTs = searchParams.get("correct");

  const journal = useJournal();
  const journalKey = useJournalKey();

  const [mode, setMode] = useState<JournalMode>("reading");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [extendedEntries, setExtendedEntries] = useState<JournalEntry[] | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [writeText, setWriteText] = useState("");
  const [writeStatus, setWriteStatus] = useState<string | null>(null);
  const [writePending, setWritePending] = useState(false);

  const [correction, setCorrection] = useState<CorrectionState>({ phase: "closed" });
  const [historyEntries, setHistoryEntries] = useState<JournalEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const draftRef = useRef<CorrectionDraft | null>(null);

  const correctConsumed = useRef(false);
  const [auditText, setAuditText] = useState<string | null>(null);

  const rawEntries: JournalEntry[] = extendedEntries
    ?? (Array.isArray(journal.data) ? journal.data : []);

  const entries = kindFilter === "all"
    ? rawEntries
    : rawEntries.filter((e) => e.kind === kindFilter);

  const effectiveIdx = selectedIdx ?? (mode === "reading" && entries.length > 0 ? 0 : null);
  const selectedEntry = effectiveIdx !== null ? entries[effectiveIdx] : null;

  useEffect(() => {
    draftRef.current = takeCorrectionDraft();
  }, []);

  const openCorrection = useCallback((entry: JournalEntry, draft: CorrectionDraft | null) => {
    const draftLabel = draft ? "Personal World drafted this proposal \u2014 review it, edit it freely, or close it" : null;
    setCorrection({
      phase: "proposed",
      entry,
      correctionText: draft?.proposed_text ?? entryText(entry),
      reason: draft?.reason ?? "",
      draftLabel,
    });
    setMode("reading");
  }, []);

  useEffect(() => {
    if (correctTs && entries.length > 0 && correction.phase === "closed" && !correctConsumed.current) {
      correctConsumed.current = true;
      const target = entries.find((e) => e.ts === correctTs);
      if (target) {
        const idx = entries.indexOf(target);
        if (idx >= 0) setSelectedIdx(idx);
        if (draftRef.current?.entry_ts === correctTs) {
          openCorrection(target, draftRef.current);
        }
      }
    }
  }, [correctTs, entries, correction.phase, openCorrection]);

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
      setWriteStatus("Saved to your journal.");
      journalKey();
      setMode("reading");
    } catch (err) {
      setWriteStatus(err instanceof Error ? err.message : "Write failed.");
    } finally {
      setWritePending(false);
    }
  }

  async function handleSupersede() {
    if (correction.phase !== "proposed") return;
    const { entry, correctionText, reason } = correction;
    const draftedBy = correction.draftLabel
      ? "Personal World (assistant draft)"
      : "the Journal screen";
    try {
      const result = await supersedeJournalEntry(entry.ts, correctionText, reason || undefined, draftedBy);
      if (result.ok) {
        setCorrection({ phase: "success", entry });
        journalKey();
      } else {
        setCorrection({
          phase: "failure",
          entry,
          warnings: result.warnings ?? ["The correction was not applied."],
        });
      }
    } catch {
      setCorrection({
        phase: "failure",
        entry,
        warnings: ["The correction was not applied. The server could not process the request."],
      });
    }
  }

  function selectEntry(idx: number) {
    setSelectedIdx(idx);
    setMode("reading");
    setCorrection({ phase: "closed" });
  }

  function handleAudit() {
    if (auditText !== null) return;
    fetchJournalAudit().then((result) => {
      if (result?.text) setAuditText(result.text);
    }).catch(() => {});
  }

  return (
    <div className="pw-journal">
      <div className="pw-journal-ambient" aria-hidden="true" />

      <nav className="pw-journal-sidebar" aria-label="Journal entries">
        <div className="pw-journal-sidebar-header">
          <h1 className="pw-journal-sidebar-title">Journal & Memory</h1>
          <p className="pw-journal-sidebar-subtitle">Your words, kept safe.</p>
        </div>

        <div className="pw-journal-sidebar-actions">
          <button
            type="button"
            className="pw-journal-write-trigger"
            onClick={() => { setMode("writing"); setSelectedIdx(null); setCorrection({ phase: "closed" }); }}
          >
            Write something new &rarr;
          </button>
        </div>

        <div className="pw-journal-sidebar-entries">
          {journal.isLoading ? (
            <p className="pw-journal-status" role="status">
              Opening your journal&hellip;
            </p>
          ) : journal.isError ? (
            <div className="pw-journal-sidebar-empty">
              <p className="pw-journal-empty-text" role="alert">
                Could not load journal entries
              </p>
              <p className="pw-journal-empty-hint">
                {journal.error instanceof Error ? journal.error.message : "The server returned an error."} The rest of your world still works.
              </p>
            </div>
          ) : rawEntries.length === 0 ? (
            <div className="pw-journal-sidebar-empty">
              <span className="pw-journal-empty-sparkle" aria-hidden="true">&#10022;</span>
              <p className="pw-journal-empty-text">
                No journal entries yet
              </p>
            </div>
          ) : (
            <>
              <div className="pw-journal-kind-filters" role="group" aria-label="Filter by kind">
                {["all", "drift", "observation"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="pw-journal-kind-filter"
                    aria-pressed={kindFilter === k}
                    onClick={() => setKindFilter(k)}
                  >
                    {k === "all" ? "All" : k.charAt(0).toUpperCase() + k.slice(1)}
                  </button>
                ))}
              </div>
              <ul className="pw-journal-sidebar-list" role="list">
                {entries.map((entry, i) => (
                  <li key={`${entry.ts}-${i}`}>
                    <button
                      type="button"
                      className={`pw-journal-sidebar-entry ${selectedIdx === i ? "pw-journal-sidebar-entry--active" : ""}`}
                      onClick={() => selectEntry(i)}
                      aria-current={selectedIdx === i ? "true" : undefined}
                    >
                      <span className="pw-journal-sidebar-entry-sparkle" aria-hidden="true">&#10022;</span>
                      <div className="pw-journal-sidebar-entry-text">
                        <time dateTime={entry.ts} className="pw-journal-sidebar-entry-time">
                          {formatDate(entry.ts)}
                        </time>
                        <span className="pw-journal-sidebar-entry-title">
                          {entryTitle(entry)}
                        </span>
                        <span className="pw-journal-sidebar-entry-kind">
                          Kind: {entry.kind}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              {!extendedEntries && (
                <button
                  type="button"
                  className="pw-journal-load-more"
                  onClick={async () => {
                    setLoadingMore(true);
                    try {
                      const data = await fetchJournalPage(100);
                      if (Array.isArray(data)) setExtendedEntries(data);
                    } catch {
                      // ignore — calm degradation
                    } finally {
                      setLoadingMore(false);
                    }
                  }}
                  disabled={loadingMore}
                  name="Load more entries"
                >
                  {loadingMore ? "Loading\u2026" : "Load more entries"}
                </button>
              )}
            </>
          )}
        </div>

        <div className="pw-journal-sidebar-footer">
          <span className="pw-journal-sidebar-footer-count">
            &#10022; {rawEntries.length} entries kept safe
          </span>
        </div>
      </nav>

      <main className="pw-journal-main" id="main-content">
        {writeStatus && mode === "reading" && (
          <div className="pw-journal-write-status-bar" role="status">
            {writeStatus}
          </div>
        )}
        {mode === "writing" ? (
          <section className="pw-journal-writing" aria-label="Write a journal entry">
            <div className="pw-journal-writing-header">
              <h2 className="pw-journal-writing-title">New entry</h2>
              <p className="pw-journal-writing-date">{formatDate(new Date().toISOString())}</p>
            </div>
            <form className="pw-journal-write" onSubmit={handleWrite}>
              <label htmlFor="journal-write-input" className="sr-only">
                Journal note
              </label>
              <textarea
                id="journal-write-input"
                className="pw-journal-write-input"
                placeholder="What&rsquo;s on your mind?"
                aria-label="Journal note"
                value={writeText}
                onChange={(e) => setWriteText(e.target.value)}
                rows={8}
                disabled={writePending}
                autoFocus
              />
              <div className="pw-journal-write-actions">
                <button
                  type="submit"
                  className="pw-journal-write-submit"
                  disabled={writePending || !writeText.trim()}
                  name="Save entry"
                >
                  {writePending ? "Writing\u2026" : "Save entry"}
                </button>
                <button
                  type="button"
                  className="pw-journal-write-cancel"
                  onClick={() => { setMode("reading"); setWriteText(""); setWriteStatus(null); }}
                >
                  Cancel
                </button>
                {writeStatus && (
                  <span className="pw-journal-write-status" role="status">
                    {writeStatus}
                  </span>
                )}
              </div>
            </form>
          </section>
        ) : selectedEntry ? (
          <article className="pw-journal-reading" aria-label="Journal entry">
            <header className="pw-journal-reading-header">
              <time dateTime={selectedEntry.ts} className="pw-journal-reading-date">
                {formatDate(selectedEntry.ts)}
              </time>
              <h2 className="pw-journal-reading-title">
                {entryTitle(selectedEntry)}
              </h2>
            </header>
            <div className="pw-journal-reading-body">
              {entryText(selectedEntry).split("\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            {selectedEntry.supersedes && (
              <div className="pw-journal-corrected-note" role="status">
                <span className="pw-journal-corrected-icon" aria-hidden="true">&#10022;</span>
                Corrected &mdash; an earlier version
              </div>
            )}

            <div className="pw-journal-reading-actions">
              <button
                type="button"
                className="pw-journal-correct-btn"
                onClick={() => openCorrection(selectedEntry, null)}
                name="Correct this entry"
              >
                Correct this entry
              </button>
            </div>

            {selectedEntry.supersedes && (
              <Disclosure summary="View history" level={3} onOpenChange={(open) => {
                if (open && historyEntries.length === 0) {
                  setHistoryLoading(true);
                  fetchJournalHistory(selectedEntry.ts).then((entries) => {
                    setHistoryEntries(entries);
                    setHistoryLoading(false);
                  }).catch(() => setHistoryLoading(false));
                }
              }}>
                {historyLoading ? (
                  <p className="pw-journal-status" role="status">Loading history&hellip;</p>
                ) : historyEntries.length > 0 ? (
                  <ul className="pw-journal-history-list" role="list">
                    {historyEntries.map((he, i) => (
                      <li key={he.ts} className="pw-journal-history-item">
                        <span className="pw-journal-history-label">
                          {i === 0 ? "Original" : `Corrected version ${i}`}
                        </span>
                        <p className="pw-journal-history-text">{entryText(he)}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="pw-journal-status">No history available.</p>
                )}
              </Disclosure>
            )}

            {correction.phase === "proposed" && correction.entry.ts === selectedEntry.ts && (
              <CorrectionPanel
                correction={correction}
                setCorrection={setCorrection}
                onApprove={handleSupersede}
              />
            )}
            {correction.phase === "success" && correction.entry.ts === selectedEntry.ts && (
              <section className="pw-journal-correction-result" data-pw-correction="success" aria-label="Correction result">
                <p className="pw-journal-correction-success" role="status">
                  Done &mdash; the corrected entry is now the current version.
                </p>
              </section>
            )}
            {correction.phase === "failure" && correction.entry.ts === selectedEntry.ts && (
              <section className="pw-journal-correction-result" data-pw-correction="failure" aria-label="Correction failure">
                <p className="pw-journal-correction-failure" role="alert">
                  The correction was not applied.
                </p>
                {correction.warnings.map((w, i) => (
                  <p key={i} className="pw-journal-correction-warning">{w}</p>
                ))}
                <button
                  type="button"
                  className="pw-journal-write-cancel"
                  onClick={() => setCorrection({ phase: "proposed", entry: correction.entry, correctionText: entryText(correction.entry), reason: "", draftLabel: null })}
                  name="Back to the proposal"
                >
                  Back to the proposal
                </button>
              </section>
            )}

            <Disclosure summary="Source" level={3}>
              <p className="pw-journal-provenance-detail">
                Recorded by {selectedEntry.provenance.source}.
              </p>
            </Disclosure>
            <Disclosure summary="Technical details" level={4}>
              <dl className="pw-journal-provenance-dl">
                <dt>Authority</dt>
                <dd>{selectedEntry.provenance.authority}</dd>
                <dt>Observed</dt>
                <dd>{selectedEntry.provenance.observed_at}</dd>
                {selectedEntry.provenance.provider && (
                  <>
                    <dt>Provider</dt>
                    <dd>{selectedEntry.provenance.provider}</dd>
                  </>
                )}
              </dl>
            </Disclosure>
          </article>
        ) : (
          <div className="pw-journal-reading-empty">
            <span className="pw-journal-empty-sparkle" aria-hidden="true">&#10022;</span>
            <p className="pw-journal-reading-empty-text">
              Select an entry to read, or write something new.
            </p>
          </div>
        )}

        <Disclosure summary="Audit trail — every entry with full provenance" level={4}>
          <button
            type="button"
            className="pw-journal-write-submit"
            onClick={handleAudit}
            name="Show the technical audit log"
          >
            Show the technical audit log
          </button>
          {auditText && (
            <pre className="pw-journal-audit-text">{auditText}</pre>
          )}
        </Disclosure>
      </main>

      <aside className="pw-journal-aside" aria-label="Journal presence">
        <div className="pw-journal-aside-companion">
          <CompanionSlot size="empty" />
          <span className="pw-journal-aside-companion-label">here with you</span>
        </div>

        {selectedEntry && (
          <div className="pw-journal-aside-status">
            <span className="pw-journal-aside-status-dot" aria-hidden="true" />
            <span className="pw-journal-aside-status-text">
              {writeStatus ?? "Saved \u00b7 read only"}
            </span>
          </div>
        )}

        <div className="pw-journal-aside-footer">
          <span className="pw-journal-aside-footer-text">&#10022; quietly here</span>
        </div>
      </aside>
    </div>
  );
}

function CorrectionPanel({
  correction,
  setCorrection,
  onApprove,
}: {
  correction: Extract<CorrectionState, { phase: "proposed" }>;
  setCorrection: React.Dispatch<React.SetStateAction<CorrectionState>>;
  onApprove: () => void;
}) {
  const { entry, correctionText, reason, draftLabel } = correction;
  const isIdentical = correctionText === entryText(entry);

  return (
    <section className="pw-journal-correction-panel" data-pw-correction="proposed" aria-label="Correct this entry">
      <h3 className="pw-journal-correction-heading">Correct this entry</h3>

      {draftLabel && (
        <p className="pw-journal-correction-draft-label" data-pw-draft-label="">
          {draftLabel}
        </p>
      )}

      <div className="pw-journal-correction-original">
        <p className="pw-journal-correction-label">Original</p>
        <p className="pw-journal-correction-text">{entryText(entry)}</p>
      </div>

      <div className="pw-journal-correction-explainer">
        <p>This corrected version <strong>stays in history</strong> and <strong>becomes the current version</strong>.</p>
        <p>Risk: low &mdash; the original is preserved, and you can correct the corrected entry again.</p>
        <p className="pw-journal-correction-status">Nothing has changed yet.</p>
      </div>

      <div className="pw-journal-correction-form">
        <div className="pw-journal-correction-field">
          <label htmlFor="correction-text" className="pw-journal-correction-label">
            Corrected entry text
          </label>
          <textarea
            id="correction-text"
            className="pw-journal-write-input"
            aria-label="Corrected entry text"
            value={correctionText}
            onChange={(e) => setCorrection({ ...correction, correctionText: e.target.value })}
            rows={4}
          />
        </div>
        <div className="pw-journal-correction-field">
          <label htmlFor="correction-reason" className="pw-journal-correction-label">
            Reason (optional)
          </label>
          <input
            id="correction-reason"
            type="text"
            className="pw-journal-correction-input"
            aria-label="Reason (optional\u2026)"
            value={reason}
            onChange={(e) => setCorrection({ ...correction, reason: e.target.value })}
            placeholder="Why are you correcting this?"
          />
        </div>
        <div className="pw-journal-correction-actions">
          <button
            type="button"
            className="pw-journal-write-submit"
            onClick={onApprove}
            disabled={isIdentical}
            name="Approve and correct"
          >
            Approve and correct
          </button>
          <button
            type="button"
            className="pw-journal-write-cancel"
            onClick={() => setCorrection({ phase: "closed" })}
            name="Close correction"
          >
            Close correction
          </button>
        </div>
      </div>
    </section>
  );
}
