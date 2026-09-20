/**
 * Journal screen — the station's append-only memory.
 *
 * Server contract (src/personal_world/api.py, verified 2026-09-20):
 *   GET  /api/journal?n          → {ok, data: JournalEvent[]} — each
 *        supersede chain's CURRENT version only, newest first.
 *   POST /api/journal {text}     → {ok, data:{written}} — a personal note.
 *   POST /api/journal/supersede  → {supersedes: ts, text, reason?} — the
 *        original is never rewritten; the new entry links back via
 *        `supersedes` and carries `supersede_reason`.
 *   GET  /api/journal/history?ts → one entry's full chain, oldest→newest
 *        (progressive disclosure — Provenance contract §5: reachable,
 *        not loud). There is no "all history" endpoint; history is per
 *        entry, so the affordance is per entry too.
 *
 * Accessibility contract: skip-to-main first, 44×44 hit areas, visible
 * focus, status by text never color alone, no animation, keyboard
 * operable, native dialog semantics (WorldDrawer).
 */

import { useState, useRef } from "react";
import {
  useJournalList,
  useWriteJournal,
  useSupersedeJournal,
  useJournalChain,
  type JournalEntry,
} from "../../data/hooks";
import { journalKindLabel } from "../../data/types";
import { WorldButton } from "../../components/WorldButton";
import { WorldDrawer } from "../../components/WorldDrawer";

// ─── Kind badge ──────────────────────────────────────────

function KindBadge({ kind }: { kind: string }) {
  const label = journalKindLabel(kind);
  return (
    <span
      className="inline-flex items-center rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-sm)] py-[var(--pw-spacing-xs)] text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-secondary)]"
      aria-label={`Kind: ${label}`}
    >
      {label}
    </span>
  );
}

function formatTs(ts: string): string {
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? ts : date.toLocaleString();
}

// ─── Entry card ──────────────────────────────────────────

interface EntryCardProps {
  entry: JournalEntry;
  onSupersede: (entry: JournalEntry) => void;
  onShowHistory: (ts: string) => void;
}

function EntryCard({ entry, onSupersede, onShowHistory }: EntryCardProps) {
  const formatted = formatTs(entry.ts);

  return (
    <article
      className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
      aria-label={`Journal ${journalKindLabel(entry.kind)} from ${formatted}`}
    >
      <div className="mb-[var(--pw-spacing-sm)] flex flex-wrap items-center gap-[var(--pw-spacing-sm)]">
        <KindBadge kind={entry.kind} />
        <time
          dateTime={entry.ts}
          className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
        >
          {formatted}
        </time>
        {entry.supersedes !== null && (
          <span className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
            Corrects an earlier entry
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap text-[var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">
        {entry.summary}
      </p>
      {entry.supersede_reason !== null && (
        <p className="mt-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          Reason: {entry.supersede_reason}
        </p>
      )}
      <p className="mt-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
        Source: {entry.provenance.source}
      </p>
      <div className="mt-[var(--pw-spacing-md)] flex flex-wrap gap-[var(--pw-spacing-md)]">
        <WorldButton
          variant="ghost"
          onPress={() => onSupersede(entry)}
          aria-label={`Supersede entry from ${formatted}`}
        >
          Supersede
        </WorldButton>
        <WorldButton
          variant="ghost"
          onPress={() => onShowHistory(entry.ts)}
          aria-label={`Show correction history for entry from ${formatted}`}
        >
          History
        </WorldButton>
      </div>
    </article>
  );
}

// ─── Write form ──────────────────────────────────────────

function WriteForm() {
  const writeMutation = useWriteJournal();
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    writeMutation.mutate(
      { text: trimmed },
      {
        onSuccess: () => {
          setContent("");
          textareaRef.current?.focus();
        },
      },
    );
  };

  return (
    <section aria-label="Write journal entry">
      <form onSubmit={handleSubmit}>
        <label
          htmlFor="journal-write-content"
          className="mb-[var(--pw-spacing-sm)] block text-[var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]"
        >
          New entry
        </label>
        <textarea
          ref={textareaRef}
          id="journal-write-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-void)] p-[var(--pw-spacing-md)] text-[var(--pw-typography-size_body)] text-[var(--pw-text-primary)] placeholder:text-[var(--pw-text-muted)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
          placeholder="Write your thoughts…"
          aria-describedby={writeMutation.isError ? "write-error" : undefined}
        />
        <div className="mt-[var(--pw-spacing-sm)] flex items-center gap-[var(--pw-spacing-md)]">
          <WorldButton
            type="submit"
            variant="primary"
            isDisabled={!content.trim() || writeMutation.isPending}
            aria-label="Submit journal entry"
          >
            {writeMutation.isPending ? "Saving…" : "Write entry"}
          </WorldButton>
          {writeMutation.isError && (
            <p
              id="write-error"
              className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
              role="alert"
            >
              {writeMutation.error instanceof Error
                ? writeMutation.error.message
                : "Failed to save entry. Please try again."}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

// ─── Supersede drawer ────────────────────────────────────

interface SupersedeDrawerProps {
  entry: JournalEntry | null;
  onClose: () => void;
}

function SupersedeDrawer({ entry, onClose }: SupersedeDrawerProps) {
  const supersedeMutation = useSupersedeJournal();
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry || !text.trim()) return;
    supersedeMutation.mutate(
      {
        supersedes: entry.ts,
        text: text.trim(),
        reason: reason.trim() || undefined,
      },
      {
        onSuccess: () => {
          setText("");
          setReason("");
          onClose();
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <WorldDrawer
      isOpen={entry !== null}
      onClose={onClose}
      title="Supersede entry"
    >
      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <label
          htmlFor="supersede-text"
          className="mb-[var(--pw-spacing-sm)] block text-[var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]"
        >
          Corrected entry
        </label>
        <textarea
          ref={textRef}
          id="supersede-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-void)] p-[var(--pw-spacing-md)] text-[var(--pw-typography-size_body)] text-[var(--pw-text-primary)] placeholder:text-[var(--pw-text-muted)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
          placeholder="What should this entry say instead?"
          aria-describedby={supersedeMutation.isError ? "supersede-error" : undefined}
          autoFocus
        />
        <label
          htmlFor="supersede-reason"
          className="mb-[var(--pw-spacing-sm)] mt-[var(--pw-spacing-md)] block text-[var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]"
        >
          Reason for superseding (optional)
        </label>
        <textarea
          id="supersede-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="w-full resize-y rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-void)] p-[var(--pw-spacing-md)] text-[var(--pw-typography-size_body)] text-[var(--pw-text-primary)] placeholder:text-[var(--pw-text-muted)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
          placeholder="Why is this entry being superseded?"
        />
        <div className="mt-[var(--pw-spacing-sm)] flex items-center gap-[var(--pw-spacing-md)]">
          <WorldButton
            type="submit"
            variant="primary"
            isDisabled={!text.trim() || supersedeMutation.isPending}
            aria-label="Confirm supersede"
          >
            {supersedeMutation.isPending ? "Saving…" : "Supersede"}
          </WorldButton>
          <WorldButton
            variant="ghost"
            onPress={onClose}
            aria-label="Cancel supersede"
          >
            Cancel
          </WorldButton>
        </div>
        {supersedeMutation.isError && (
          <p
            id="supersede-error"
            className="mt-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
            role="alert"
          >
            {supersedeMutation.error instanceof Error
              ? supersedeMutation.error.message
              : "Failed to supersede entry. Please try again."}
          </p>
        )}
      </form>
    </WorldDrawer>
  );
}

// ─── History drawer (one chain, server-ordered oldest → newest) ─────

interface HistoryDrawerProps {
  ts: string | null;
  onClose: () => void;
}

function HistoryDrawer({ ts, onClose }: HistoryDrawerProps) {
  const chainQuery = useJournalChain(ts);

  return (
    <WorldDrawer isOpen={ts !== null} onClose={onClose} title="Correction history">
      {chainQuery.isPending && ts !== null && (
        <p className="text-[var(--pw-typography-size_body)] text-[var(--pw-text-muted)]">
          Loading…
        </p>
      )}
      {chainQuery.isError && (
        <p
          role="alert"
          className="text-[var(--pw-typography-size_body)] text-[var(--pw-text-secondary)]"
        >
          {chainQuery.error instanceof Error
            ? chainQuery.error.message
            : "Unable to load this entry's history."}
        </p>
      )}
      {chainQuery.isSuccess && (
        <ol className="space-y-[var(--pw-spacing-md)]">
          {chainQuery.data.map((e) => (
            <li
              key={e.ts}
              className="rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] p-[var(--pw-spacing-md)]"
            >
              <div className="mb-1 flex flex-wrap items-center gap-[var(--pw-spacing-sm)]">
                <KindBadge kind={e.kind} />
                <time
                  dateTime={e.ts}
                  className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
                >
                  {formatTs(e.ts)}
                </time>
              </div>
              <p className="whitespace-pre-wrap text-[var(--pw-typography-size_small)] text-[var(--pw-text-primary)]">
                {e.summary}
              </p>
              {e.supersede_reason !== null && (
                <p className="mt-1 text-[var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
                  Reason: {e.supersede_reason}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </WorldDrawer>
  );
}

// ─── Main screen ─────────────────────────────────────────

export function Journal() {
  const [supersedeEntry, setSupersedeEntry] = useState<JournalEntry | null>(
    null,
  );
  const [historyTs, setHistoryTs] = useState<string | null>(null);

  const listQuery = useJournalList({ n: 50 });
  const entries = listQuery.data?.data ?? [];

  return (
    <>
      {/* Skip-to-main-content — first focusable element */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-[var(--pw-radius-sm)] focus:bg-[var(--pw-surface-panel)] focus:p-[var(--pw-spacing-md)] focus:text-[var(--pw-text-primary)] focus:ring-2 focus:ring-[var(--pw-accent-teal)]"
      >
        Skip to main content
      </a>

      <main
        id="main-content"
        aria-label="Journal"
        className="mx-auto max-w-2xl space-y-[var(--pw-spacing-xl)] p-[var(--pw-spacing-lg)]"
      >
        <h1 className="text-[var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]">
          Journal
        </h1>

        {/* Write form */}
        <WriteForm />

        {/* Status */}
        {listQuery.isPending && (
          <p
            className="text-[var(--pw-typography-size_body)] text-[var(--pw-text-secondary)]"
            aria-live="polite"
          >
            Loading…
          </p>
        )}

        {listQuery.isError && (
          <div
            className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
            role="alert"
          >
            <p className="text-[var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]">
              Unable to load journal
            </p>
            <p className="mt-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
              {listQuery.error instanceof Error
                ? listQuery.error.message
                : "An unexpected error occurred while loading journal entries."}
            </p>
          </div>
        )}

        {/* Entry list — current versions of every chain. The list
            endpoint always answers ok:true today; anything else is
            rendered as the failure it would be, never as "empty". */}
        {listQuery.isSuccess && listQuery.data.ok !== true && (
          <div
            className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
            role="alert"
          >
            <p className="text-[var(--pw-typography-size_body)] text-[var(--pw-text-secondary)]">
              The journal did not answer cleanly — showing nothing rather
              than guessing.
            </p>
          </div>
        )}

        {listQuery.isSuccess && listQuery.data.ok === true && entries.length === 0 && (
          <div
            className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-xl)] text-center"
            aria-label="Empty state"
          >
            <p className="text-[var(--pw-typography-size_body)] text-[var(--pw-text-secondary)]">
              No journal entries yet. Start writing to capture your thoughts.
            </p>
          </div>
        )}

        {listQuery.isSuccess && listQuery.data.ok === true && entries.length > 0 && (
          <section aria-label="Journal entries">
            <ul className="space-y-[var(--pw-spacing-md)]" role="list">
              {entries.map((entry) => (
                <li key={entry.ts}>
                  <EntryCard
                    entry={entry}
                    onSupersede={setSupersedeEntry}
                    onShowHistory={setHistoryTs}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* Supersede drawer */}
      <SupersedeDrawer
        entry={supersedeEntry}
        onClose={() => setSupersedeEntry(null)}
      />

      {/* Per-entry history drawer */}
      <HistoryDrawer ts={historyTs} onClose={() => setHistoryTs(null)} />
    </>
  );
}
