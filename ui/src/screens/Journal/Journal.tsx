/**
 * Journal screen — entry list with write, supersede, and history view.
 *
 * Accessibility contract:
 *   - Skip-to-main-content as first focusable element
 *   - 44×44px minimum hit areas on all interactive elements
 *   - Focus always visible: 2px solid teal
 *   - Status never by color alone — always text labels
 *   - No animation — static "Loading…" only
 *   - Keyboard-operable: Tab/Enter/Escape
 *   - Native dialog/popover semantics (WorldDrawer)
 */

import { useState, useRef } from "react";
import {
  useJournalList,
  useWriteJournal,
  useSupersedeJournal,
  useJournalHistory,
  type JournalEntry,
} from "../../data/hooks";
import { WorldButton } from "../../components/WorldButton";
import { WorldDrawer } from "../../components/WorldDrawer";

// ─── Kind badge ──────────────────────────────────────────

const KIND_LABELS: Record<JournalEntry["kind"], string> = {
  entry: "Entry",
  correction: "Correction",
  supersession: "Supersession",
};

function KindBadge({ kind }: { kind: JournalEntry["kind"] }) {
  return (
    <span
      className="inline-flex items-center rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-sm)] py-[var(--pw-spacing-xs)] text-[var(--pw-typography-size_small)] font-medium text-[var(--pw-text-secondary)]"
      aria-label={`Kind: ${KIND_LABELS[kind]}`}
    >
      {KIND_LABELS[kind]}
    </span>
  );
}

// ─── Entry card ──────────────────────────────────────────

interface EntryCardProps {
  entry: JournalEntry;
  onSupersede: (entryId: string) => void;
}

function EntryCard({ entry, onSupersede }: EntryCardProps) {
  const formatted = new Date(entry.timestamp).toLocaleString();

  return (
    <article
      className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
      aria-label={`Journal ${KIND_LABELS[entry.kind]} from ${formatted}`}
    >
      <div className="mb-[var(--pw-spacing-sm)] flex flex-wrap items-center gap-[var(--pw-spacing-sm)]">
        <KindBadge kind={entry.kind} />
        <time
          dateTime={entry.timestamp}
          className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
        >
          {formatted}
        </time>
        {entry.superseded_by && (
          <span className="text-[var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
            Superseded
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap text-[var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">
        {entry.content}
      </p>
      {!entry.superseded_by && (
        <div className="mt-[var(--pw-spacing-md)]">
          <WorldButton
            variant="ghost"
            onPress={() => onSupersede(entry.id)}
            aria-label={`Supersede entry from ${formatted}`}
          >
            Supersede
          </WorldButton>
        </div>
      )}
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
      { content: trimmed, kind: "entry" },
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
          className="w-full resize-y rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-void)] p-[var(--pw-spacing-md)] text-[var(--pw-typography-size_body)] text-[var(--pw-text-primary)] placeholder:text-[var(--pw-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--pw-accent-teal)]"
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
  entryId: string | null;
  onClose: () => void;
}

function SupersedeDrawer({ entryId, onClose }: SupersedeDrawerProps) {
  const supersedeMutation = useSupersedeJournal();
  const [reason, setReason] = useState("");
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryId || !reason.trim()) return;
    supersedeMutation.mutate(
      { entry_id: entryId, reason: reason.trim() },
      {
        onSuccess: () => {
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
      isOpen={entryId !== null}
      onClose={onClose}
      title="Supersede entry"
    >
      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <label
          htmlFor="supersede-reason"
          className="mb-[var(--pw-spacing-sm)] block text-[var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]"
        >
          Reason for superseding
        </label>
        <textarea
          ref={reasonRef}
          id="supersede-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full resize-y rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-void)] p-[var(--pw-spacing-md)] text-[var(--pw-typography-size_body)] text-[var(--pw-text-primary)] placeholder:text-[var(--pw-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--pw-accent-teal)]"
          placeholder="Why is this entry being superseded?"
          aria-describedby={
            supersedeMutation.isError ? "supersede-error" : undefined
          }
          autoFocus
        />
        <div className="mt-[var(--pw-spacing-sm)] flex items-center gap-[var(--pw-spacing-md)]">
          <WorldButton
            type="submit"
            variant="primary"
            isDisabled={!reason.trim() || supersedeMutation.isPending}
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

// ─── Main screen ─────────────────────────────────────────

export function Journal() {
  const [showHistory, setShowHistory] = useState(false);
  const [supersedeEntryId, setSupersedeEntryId] = useState<string | null>(null);

  const listQuery = useJournalList({ limit: 50 });
  const historyQuery = useJournalHistory(50);

  const activeQuery = showHistory ? historyQuery : listQuery;
  const entries = showHistory
    ? (historyQuery.data?.history ?? [])
    : (listQuery.data?.entries ?? []);

  return (
    <>
      {/* Skip-to-main-content — first focusable element */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-[var(--pw-radius-sm)] focus:bg-[var(--pw-surface-panel)] focus:p-[var(--pw-spacing-md)] focus:text-[var(--pw-typography-size_body)] focus:text-[var(--pw-text-primary)] focus:ring-2 focus:ring-[var(--pw-accent-teal)]"
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

        {/* View toggle */}
        <div className="flex items-center gap-[var(--pw-spacing-md)]">
          <WorldButton
            variant={!showHistory ? "primary" : "ghost"}
            onPress={() => setShowHistory(false)}
            aria-pressed={!showHistory}
            aria-label="Show current entries"
          >
            Entries
          </WorldButton>
          <WorldButton
            variant={showHistory ? "primary" : "ghost"}
            onPress={() => setShowHistory(true)}
            aria-pressed={showHistory}
            aria-label="Show full history including superseded entries"
          >
            History
          </WorldButton>
        </div>

        {/* Status */}
        {activeQuery.isLoading && (
          <p
            className="text-[var(--pw-typography-size_body)] text-[var(--pw-text-secondary)]"
            aria-live="polite"
          >
            Loading…
          </p>
        )}

        {activeQuery.isError && (
          <div
            className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
            role="alert"
          >
            <p className="text-[var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]">
              Unable to load journal
            </p>
            <p className="mt-[var(--pw-spacing-sm)] text-[var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
              {activeQuery.error instanceof Error
                ? activeQuery.error.message
                : "An unexpected error occurred while loading journal entries."}
            </p>
          </div>
        )}

        {/* Entry list */}
        {activeQuery.isSuccess && entries.length === 0 && (
          <div
            className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-xl)] text-center"
            aria-label="Empty state"
          >
            <p className="text-[var(--pw-typography-size_body)] text-[var(--pw-text-secondary)]">
              No journal entries yet. Start writing to capture your thoughts.
            </p>
          </div>
        )}

        {activeQuery.isSuccess && entries.length > 0 && (
          <section aria-label={showHistory ? "Journal history" : "Journal entries"}>
            <ul className="space-y-[var(--pw-spacing-md)]" role="list">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <EntryCard
                    entry={entry}
                    onSupersede={setSupersedeEntryId}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* Supersede drawer */}
      <SupersedeDrawer
        entryId={supersedeEntryId}
        onClose={() => setSupersedeEntryId(null)}
      />
    </>
  );
}
