/**
 * ThreadCard — the daily home loop's "Resume" beat (TRUE-NORTH):
 * yesterday's thread, one tap back into it.
 *
 * Source: GET /api/journal/last through useJournalLast — the server
 * answers which entry is newest (the calm-view tail, API-084), so the
 * card is right against the real backend, whose GET /api/journal window
 * is oldest→newest. The tap is the same state-driven path the nav uses
 * (onOpenArea), so the door is never a dead href.
 *
 * Honest states: pending renders nothing (no shimmer, §1.5); a query
 * error says the journal is unreachable in plain words; an empty
 * journal gets a warm, true empty line. Never a placeholder thread.
 */

import { useJournalLast } from "../../data/hooks";
import { journalKindLabel } from "../../data/types";
import { lastThread, threadWhen } from "./home-loop";

interface ThreadCardProps {
  onOpenMemory: () => void;
}

export function ThreadCard({ onOpenMemory }: ThreadCardProps) {
  const last = useJournalLast();
  const entry = lastThread(last.data);

  if (last.isPending) return null;

  if (last.isError) {
    return (
      <section aria-label="Your thread" className="mb-[var(--pw-spacing-2xl)]">
        <h2 className="mb-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
          Your thread
        </h2>
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          Your journal is unreachable right now. Memory still opens
          without it.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Your thread" className="mb-[var(--pw-spacing-2xl)]">
      <h2 className="mb-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
        Your thread
      </h2>
      <div className="rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]">
        {entry === null ? (
          <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            Nothing written yet. Your thread starts whenever you do —
            Memory keeps every word of it.
          </p>
        ) : (
          <>
            <p className="text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">
              {entry.summary}
            </p>
            <p className="mt-1 text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
              {journalKindLabel(entry.kind)} · {threadWhen(entry.ts)}
            </p>
          </>
        )}
        <button
          type="button"
          onClick={onOpenMemory}
          className="mt-[var(--pw-spacing-md)] inline-flex min-h-[var(--pw-targets-minimum)] items-center text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-accent-primary)] underline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
        >
          Pick up in Memory
        </button>
      </div>
    </section>
  );
}
