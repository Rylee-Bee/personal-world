/**
 * RoomsPanel — the estate's rooms on the Bridge (contract: room/0).
 *
 * Worlds shows rooms; it never copies their code. Each row is one
 * small backend: a decorative identity mark, its name, the honest
 * status WORD (text, never color alone — accessibility contract §1.3),
 * the needs it is charging attention for (count + first title), and an
 * "Open" link to the room's own address in a new tab. An unreachable
 * room reads "unreachable · last seen <time>" or "unreachable · never
 * reached" with its short error — never blanked, never shown healthy
 * (room/0 rules 11–12).
 *
 * Accessibility: status is text; every target (the Open link) is a real
 * anchor with a spoken label and a 44px hit area; no animation; one list
 * item per room. Loading and failure are named plainly.
 */

import { useRooms } from "../data/hooks";
import type { RoomRow } from "../data/contract";

/** The five honest words a room row can carry. `unreachable` is the
 *  front door's own word, added for a room that did not answer. */
const STATUS_WORDS: Record<string, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  unhealthy: "Unhealthy",
  unknown: "Unknown",
  unreachable: "Unreachable",
};

function statusWord(raw: string): string {
  return STATUS_WORDS[raw] ?? "Unknown";
}

function formatTime(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "an unknown time";
  return when.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function identityMark(row: RoomRow): string {
  const name = row.room?.name?.trim() || row.id.trim();
  return name.charAt(0).toUpperCase() || "✦";
}

export function RoomsPanel() {
  const rooms = useRooms();
  const rows = rooms.data?.data;

  return (
    <section
      aria-label="Rooms"
      className="bridge-rooms rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
    >
      <h2 className="text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
        Rooms
      </h2>

      {rooms.isPending ? (
        <p className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
          Checking your rooms…
        </p>
      ) : rooms.isError || rows === undefined ? (
        <p className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          Couldn't check your rooms right now. Nothing here is invented.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          No rooms are set up yet.
        </p>
      ) : (
        <ul className="mt-[var(--pw-spacing-sm)] space-y-[var(--pw-spacing-sm)]">
          {rows.map((row) => (
            <RoomListItem key={row.id} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RoomListItem({ row }: { row: RoomRow }) {
  const name = row.room?.name?.trim() || row.id;
  const word = statusWord(row.status);
  const needs = row.needs_you ?? [];
  const firstNeed = needs[0];

  return (
    <li className="rounded-[var(--pw-radius-sm)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)]">
      <div className="flex flex-wrap items-center gap-[var(--pw-spacing-sm)]">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--pw-radius-full)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-accent-primary)]"
        >
          {identityMark(row)}
        </span>
        <span className="min-w-0 flex-1 text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-text-primary)]">
          {name}
        </span>
        <span className="shrink-0 text-[length:var(--pw-typography-size_micro)] font-medium text-[var(--pw-text-secondary)]">
          {word}
        </span>
      </div>

      {row.reachable ? (
        <p className="mt-[var(--pw-spacing-xs)] text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
          {needs.length > 0 && firstNeed
            ? `${needs.length} need${needs.length === 1 ? "" : "s"} you · ${firstNeed.title}`
            : "Nothing needs you right now."}
        </p>
      ) : (
        <p className="mt-[var(--pw-spacing-xs)] text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
          {`unreachable · ${
            row.last_seen ? `last seen ${formatTime(row.last_seen)}` : "never reached"
          }`}
        </p>
      )}

      {row.reachable && row.error !== null && (
        <p className="mt-[var(--pw-spacing-xs)] text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
          {`Couldn't read its needs: ${row.error}`}
        </p>
      )}

      <a
        href={row.base_url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${name} in a new tab`}
        className="mt-[var(--pw-spacing-sm)] inline-flex min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] items-center text-[length:var(--pw-typography-size_small)] font-medium text-[var(--pw-accent-primary)] underline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]"
      >
        Open
      </a>
    </li>
  );
}