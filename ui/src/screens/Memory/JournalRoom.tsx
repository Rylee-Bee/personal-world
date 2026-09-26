/**
 * JournalRoom — the journal spine INSIDE the Memory screen.
 *
 * docs/PRODUCT-LANGUAGE.md makes Memory one deterministic place, and
 * the journal is its spine: this is the former standalone Journal
 * screen, re-flowed as a section of Memory (write, entry list,
 * supersede and per-entry history all unchanged). Memory owns the
 * <main>, the skip link and the h1; this file keeps its own two
 * drawers mounted at the fragment level like before.
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
 * Accessibility contract (as in Memory): 44×44 hit areas, visible
 * focus, status by text never color alone, no animation, keyboard
 * operable, native dialog semantics (WorldDrawer).
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  clearLocalMirror,
  createDraftSync,
  draftStatusLine,
  flushLegacyDrafts,
  liveTransport,
  readLocalMirror,
  resolveResume,
  writeLocalMirror,
  type DraftStatus,
  type DraftSync,
} from "../../data/draft-sync";

// ─── Kind badge ──────────────────────────────────────────

function KindBadge({ kind }: { kind: string }) {
  const label = journalKindLabel(kind);
  return (
    <span
      className="inline-flex items-center rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] px-[var(--pw-spacing-sm)] py-[var(--pw-spacing-xs)] text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-text-secondary)]"
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
          className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
        >
          {formatted}
        </time>
        {entry.supersedes !== null && (
          <span className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
            Corrects an earlier entry
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">
        {entry.summary}
      </p>
      {entry.supersede_reason !== null && (
        <p className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          Reason: {entry.supersede_reason}
        </p>
      )}
      <p className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
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

interface DraftConflict {
  /** The world's newer text, and the stamp that proves it newer. */
  serverText: string;
  serverStamp: string;
  /** This device's text the person may choose to keep. */
  localText: string;
}

/**
 * Write form — the journal panel that RESUMES (B8: her visible face
 * of the draft-sync client; DRAFT-SYNC-SPEC-2026-09-20):
 *   • keystroke pauses put the draft to /api/journal/draft (B1/B7),
 *   • legacy pw-journal-entries flush once on load (B2),
 *   • GET-on-open resumes; a newer world copy offers a two-option
 *     chooser instead of clobbering either side (B3),
 *   • the one honest status line carries sync state (spec cadence),
 *   • after a CONFIRMED publish the draft is cleared (DELETE),
 *   • no draft text ever reaches console or error surfaces (B4).
 */
function WriteForm() {
  const writeMutation = useWriteJournal();
  const [content, setContent] = useState("");
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [conflict, setConflict] = useState<DraftConflict | null>(null);
  const [resumeNote, setResumeNote] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const syncRef = useRef<DraftSync | null>(null);

  // ── Open the panel: legacy flush, then GET-on-open (B2 + B3) ──
  useEffect(() => {
    const sync = createDraftSync();
    syncRef.current = sync;
    const unsubscribe = sync.subscribe(setDraftStatus);
    const onPageHide = (): void => {
      void sync.flush();
    };
    window.addEventListener("pagehide", onPageHide);
    let cancelled = false;

    void (async () => {
      // Legacy notes first: if this device still holds old-Station
      // keys, the world should hold them before we offer anything.
      await flushLegacyDrafts(window.localStorage, liveTransport).catch(
        () => undefined, // deferred keys stay put; next load retries
      );
      if (cancelled) return;
      const local = readLocalMirror(window.localStorage);
      let server;
      try {
        server = await liveTransport.get();
      } catch {
        // Offline at open: resume from this device's own mirror.
        if (local && local.text.trim() !== "") {
          setContent(local.text);
          setResumeNote("Offline — showing this device's draft.");
        }
        return;
      }
      if (cancelled || server === null) return;
      const decision = resolveResume(server, local);
      switch (decision.kind) {
        case "take-server":
          if (decision.text !== null && decision.text.trim() !== "") {
            setContent(decision.text);
            setResumeNote("Resumed your unsaved draft.");
          }
          break;
        case "offer-local":
          if (local) {
            setContent(local.text);
            // The world has nothing newer: our copy is the next save.
            sync.notify({ text: local.text });
          }
          break;
        case "agree":
          // Quietly resume: the same words live on both sides, and
          // THIS is the draft she was writing.
          if (server.text !== null) setContent(server.text);
          break;
        case "conflict":
          setConflict({
            serverText: decision.server.text ?? "",
            serverStamp: decision.server.updated_at ?? "",
            localText: decision.local.text,
          });
          break;
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", onPageHide);
      void sync.flush();
      unsubscribe();
      sync.destroy();
      syncRef.current = null;
    };
  }, []);

  // Keep the chooser keyboard-first: focus lands on its first option
  // (WorldButton renders no ref, so the focus-by-id seam stays DOM-level).
  useEffect(() => {
    if (conflict !== null) {
      document.getElementById("draft-conflict-server")?.focus();
    }
  }, [conflict]);

  // `conflict` is a plain dependency, not a ref: while the chooser is
  // open, keystrokes update content only — no mirror write, no sync
  // notify until the person has chosen a side. (The old ref-carrier
  // version assigned ref.current during render, the exact pattern
  // oxlint's React refs rule flags; state-in-deps is the fix.)
  const handleChange = useCallback(
    (value: string) => {
      setContent(value);
      const sync = syncRef.current;
      if (sync === null || conflict !== null) return;
      writeLocalMirror(window.localStorage, {
        text: value,
        editedAt: new Date().toISOString(),
        serverStamp: sync.lastSavedAt(),
      });
      sync.notify({ text: value });
    },
    [conflict],
  );

  const chooseServerCopy = useCallback(() => {
    if (conflict === null) return;
    setContent(conflict.serverText);
    writeLocalMirror(window.localStorage, {
      text: conflict.serverText,
      editedAt: new Date().toISOString(),
      serverStamp: conflict.serverStamp || null,
    });
    setConflict(null);
    setResumeNote("Continuing from the world's copy.");
  }, [conflict]);

  const keepLocalCopy = useCallback(() => {
    if (conflict === null) return;
    setConflict(null);
    setContent(conflict.localText);
    // Explicit human choice: this device's words go up next.
    syncRef.current?.notify({ text: conflict.localText });
    setResumeNote("Keeping this device's draft.");
  }, [conflict]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    writeMutation.mutate(
      { text: trimmed },
      {
        onSuccess: () => {
          setContent("");
          // Spec: the client clears the draft only after the publish
          // was CONFIRMED — then both copies are safe.
          clearLocalMirror(window.localStorage);
          void liveTransport.remove().catch(() => undefined);
          setResumeNote(null);
          textareaRef.current?.focus();
        },
      },
    );
  };

  return (
    <section aria-label="Write journal entry">
      {conflict !== null && (
        <div
          role="alertdialog"
          aria-labelledby="draft-conflict-title"
          className="mb-[var(--pw-spacing-md)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-md)]"
        >
          <p
            id="draft-conflict-title"
            className="text-[length:var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]"
          >
            Two unsaved drafts are alive
          </p>
          <p className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            The world holds a draft that changed after this device last
            saved. Nothing is overwritten until you choose.
          </p>
          <div className="mt-[var(--pw-spacing-md)] flex flex-wrap gap-[var(--pw-spacing-md)]">
            <WorldButton
              id="draft-conflict-server"
              variant="primary"
              onPress={chooseServerCopy}
              aria-label="Continue from the world's copy"
            >
              Continue from the world's copy
            </WorldButton>
            <WorldButton
              variant="ghost"
              onPress={keepLocalCopy}
              aria-label="Keep this device's draft"
            >
              Keep this device's draft
            </WorldButton>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <label
          htmlFor="journal-write-content"
          className="mb-[var(--pw-spacing-sm)] block text-[length:var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]"
        >
          New entry
        </label>
        <textarea
          ref={textareaRef}
          id="journal-write-content"
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-void)] p-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] placeholder:text-[var(--pw-text-muted)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
          placeholder="Write your thoughts…"
          aria-describedby={
            writeMutation.isError
              ? "write-error"
              : resumeNote
                ? "draft-resume-note"
                : undefined
          }
        />
        <div
          id="journal-write-actions"
          className="mt-[var(--pw-spacing-sm)] flex items-center gap-[var(--pw-spacing-md)] pb-[var(--pw-safe-area-inset-bottom)]"
        >
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
              className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
              role="alert"
            >
              {writeMutation.error instanceof Error
                ? writeMutation.error.message
                : "Failed to save entry. Please try again."}
            </p>
          )}
        </div>
        {/* One honest state line (spec §write cadence) — text never
            echoes here, only status words. */}
        <p
          aria-live="polite"
          className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]"
        >
          {resumeNote ?? draftStatusLine(draftStatus)}
        </p>
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
          className="mb-[var(--pw-spacing-sm)] block text-[length:var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]"
        >
          Corrected entry
        </label>
        <textarea
          ref={textRef}
          id="supersede-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-void)] p-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] placeholder:text-[var(--pw-text-muted)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
          placeholder="What should this entry say instead?"
          aria-describedby={supersedeMutation.isError ? "supersede-error" : undefined}
          autoFocus
        />
        <label
          htmlFor="supersede-reason"
          className="mb-[var(--pw-spacing-sm)] mt-[var(--pw-spacing-md)] block text-[length:var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]"
        >
          Reason for superseding (optional)
        </label>
        <textarea
          id="supersede-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="w-full resize-y rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-void)] p-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)] placeholder:text-[var(--pw-text-muted)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
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
            className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
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
        <p className="text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-muted)]">
          Loading…
        </p>
      )}
      {chainQuery.isError && (
        <p
          role="alert"
          className="text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-secondary)]"
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
                  className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
                >
                  {formatTs(e.ts)}
                </time>
              </div>
              <p className="whitespace-pre-wrap text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-primary)]">
                {e.summary}
              </p>
              {e.supersede_reason !== null && (
                <p className="mt-1 text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
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

export function JournalRoom() {
  const [supersedeEntry, setSupersedeEntry] = useState<JournalEntry | null>(
    null,
  );
  const [historyTs, setHistoryTs] = useState<string | null>(null);

  const listQuery = useJournalList({ n: 50 });
  const entries = listQuery.data?.data ?? [];

  return (
    <>
      <section
        aria-labelledby="memory-journal-heading"
        className="space-y-[var(--pw-spacing-lg)]"
      >
        <header>
          <h2
            id="memory-journal-heading"
            className="text-[length:var(--pw-typography-size_h2)] font-semibold text-[var(--pw-text-primary)]"
            style={{ fontFamily: "var(--pw-typography-font_serif, inherit)" }}
          >
            Journal
          </h2>
          <p className="mt-1 text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            The append-only spine of Memory. Corrections supersede an
            entry — the original is never rewritten.
          </p>
        </header>

        {/* Write form */}
        <WriteForm />

        {/* Status */}
        {listQuery.isPending && (
          <p
            className="text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-secondary)]"
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
            <p className="text-[length:var(--pw-typography-size_body)] font-medium text-[var(--pw-text-primary)]">
              Unable to load journal
            </p>
            <p className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
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
            <p className="text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-secondary)]">
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
            <p className="text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-secondary)]">
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
      </section>

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
