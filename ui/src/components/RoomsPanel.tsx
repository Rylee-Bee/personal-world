/**
 * RoomsPanel — the estate's rooms on the Bridge (contract: room/0),
 * in the Doorways structure (owner direction B, 2026-09-25).
 *
 * Worlds shows rooms; it never copies their code. The structure is the
 * same in EVERY theme (owner decision: a theme changes art, never where
 * things are):
 *
 *   1. a summary line in words;
 *   2. rooms that need you, as doorway cards — at most MAX_DOORWAYS,
 *      the longest-waiting first;
 *   3. the corridor: "Also needs you" (overflow), "Unknown or
 *      unreachable", "Other rooms" (answering, not healthy, nothing
 *      waiting) and a collapsible "Quiet" group (healthy, nothing
 *      waiting).
 *
 * Art is an optional slot: room interiors only in the Doorways theme (a
 * doorway the person chose on the Crew page, else the room's own drawn
 * interior, else the plain arch — never assigned automatically),
 * keeper portraits only when the personality pack is on. Both are
 * decorative (alt="", aria-hidden) — every fact they could suggest is
 * already in words. A room with no keeper shows its own initial in a
 * lantern ring; a keeper with no picture wears the crew commbadge with
 * their initial.
 *
 * Per-person state (GET /api/rooms, Worlds-owned, never sent to rooms):
 * who keeps each room (`keeper`), which needs you've marked seen,
 * what changed since your last visit, and where you left off (`resume`).
 * Opening a room records a visit; "Mark as seen" quiets one need without
 * pretending the room fixed it.
 *
 * Honesty (room/0 rules 11–12): an unreachable room reads
 * "unreachable · last seen <time>" or "unreachable · never reached" —
 * never blanked, never shown healthy, and never counted as quiet.
 * Loading, failure and emptiness are named plainly; nothing is invented.
 *
 * Accessibility: status is always a word (§1.3); each doorway is an
 * article with its own heading; every target (the Open links, the Quiet
 * toggle) is a real control with a spoken label and a 44px hit area; no
 * animation.
 */

import { useState } from "react";
import { useMarkNeedSeen, useRooms, useVisitRoom } from "../data/hooks";
import type { RoomKeeper, RoomRow, RoomsResume, RoomsSummary } from "../data/contract";
import { interiorUrl, keeperPortraitUrl } from "./rooms/crew";
import { useDoorwayChoices } from "./rooms/doorwayChoice";
import { CompanionFace } from "./crew/CompanionFace";
import { currentNeeds, groupRooms, isUncertain, seenNeeds } from "./rooms/groupRooms";
import { useMinuteClock, useRootAttribute } from "./rooms/useRootAttribute";

/** How old a check can be before the panel says so in words. */
const STALE_AFTER_MS = 15 * 60 * 1000;

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

function roomName(row: RoomRow): string {
  return row.room?.name?.trim() || row.id;
}

function initial(row: RoomRow): string {
  return roomName(row).charAt(0).toUpperCase() || "✦";
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** One line under a room's name: what it needs, or why we can't say. */
function detailLine(row: RoomRow): string {
  if (!row.reachable) {
    return `unreachable · ${
      row.last_seen ? `last seen ${formatTime(row.last_seen)}` : "never reached"
    }`;
  }
  const needs = currentNeeds(row);
  const first = needs[0];
  if (needs.length > 0 && first) {
    return `${plural(needs.length, "need", "needs")} you · ${first.title}`;
  }
  const parts: string[] = [];
  if (row.status === "unknown") parts.push("Answering, but hasn't reported a status");
  else parts.push("Nothing new needs you");
  const seen = seenNeeds(row).length;
  if (seen > 0) parts.push(`${plural(seen, "need", "needs")} you've seen`);
  const changed = row.changed_since_visit ?? 0;
  if (changed > 0) parts.push(`${changed} new since you last looked`);
  return `${parts.join(" · ")}.`;
}

// ─── Shared pieces ───────────────────────────────────────────────────

const LINK_BASE =
  "inline-flex min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] items-center justify-center rounded-[var(--pw-radius-sm)] px-[var(--pw-spacing-lg)] text-[length:var(--pw-typography-size_small)] font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-[var(--pw-accent-primary)]";

function OpenLink({
  row,
  primary = false,
  label,
}: {
  row: RoomRow;
  primary?: boolean;
  label?: string;
}) {
  const name = roomName(row);
  const visit = useVisitRoom();
  return (
    <a
      href={row.base_url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label ?? `Open ${name}`} in a new tab`}
      // Opening a room is the visit. Recorded after the tab opens, never
      // in its way; a failed write only leaves the old baseline.
      onClick={() => visit.mutate({ roomId: row.id, title: name })}
      className={`${LINK_BASE} ${
        primary
          ? "bg-[var(--pw-accent-warm)] text-[var(--pw-surface-void)]"
          : "border border-[var(--pw-border-subtle)] text-[var(--pw-text-primary)] underline"
      }`}
    >
      {label ?? `Open ${name}`}
    </a>
  );
}

function StatusWord({ row }: { row: RoomRow }) {
  return (
    <span className="shrink-0 text-[length:var(--pw-typography-size_micro)] font-medium text-[var(--pw-text-secondary)]">
      {row.reachable ? statusWord(row.status) : "Unreachable"}
    </span>
  );
}

/** A room's face: its keeper (pack on) — their picture, or the crew
 *  commbadge with their initial — or, with no keeper, the room's own
 *  initial in a lantern ring. */
function Emblem({
  row,
  keeper,
  size,
}: {
  row: RoomRow;
  keeper: RoomKeeper | null;
  size: "sm" | "lg";
}) {
  const dim = isUncertain(row);
  if (keeper) {
    return (
      <CompanionFace
        name={keeper.name}
        initial={keeper.initial}
        portrait={keeperPortraitUrl(keeper)}
        size={size}
        dim={dim}
      />
    );
  }
  const box = size === "lg" ? "h-20 w-20 text-3xl" : "h-10 w-10 text-lg";
  return (
    <span
      aria-hidden="true"
      className={`flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-[var(--pw-radius-full)] border-2 ${
        dim ? "border-dashed border-[var(--pw-text-muted)]" : "border-[var(--pw-accent-warm)]"
      } bg-[var(--pw-surface-hull)] font-semibold text-[var(--pw-accent-warm)]`}
    >
      {initial(row)}
    </span>
  );
}

// ─── Doorway (rooms that need you) ───────────────────────────────────

function Doorway({
  row,
  showInteriors,
  keeper,
}: {
  row: RoomRow;
  showInteriors: boolean;
  keeper: RoomKeeper | null;
}) {
  const name = roomName(row);
  const needs = currentNeeds(row);
  const first = needs[0];
  const doorways = useDoorwayChoices();
  const interior = showInteriors ? interiorUrl(row.id, doorways[row.id]) : null;
  const headingId = `room-${row.id}-name`;
  const markSeen = useMarkNeedSeen();
  const changed = row.changed_since_visit ?? 0;

  return (
    <article
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col overflow-hidden rounded-[var(--pw-radius-lg)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)]"
    >
      <div
        aria-hidden="true"
        className="relative mx-[var(--pw-spacing-md)] mt-[var(--pw-spacing-md)] flex h-48 justify-center min-[860px]:h-64"
      >
        {interior ? (
          <img src={interior} alt="" className="h-full w-auto object-contain" />
        ) : (
          <span className="flex h-full w-40 flex-col items-center justify-center gap-[var(--pw-spacing-sm)] rounded-t-full rounded-b-[var(--pw-radius-md)] border-2 border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] text-[var(--pw-accent-warm)]">
            <span className="text-2xl">✦</span>
          </span>
        )}
        <span className="absolute bottom-[-6px] left-0">
          <Emblem row={row} keeper={keeper} size="lg" />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-[var(--pw-spacing-xs)] p-[var(--pw-spacing-lg)] pt-[var(--pw-spacing-xl)]">
        <p className="self-start rounded-[var(--pw-radius-sm)] border border-[var(--pw-accent-warm)] bg-[var(--pw-accent-warm_soft)] px-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_label)] font-bold uppercase tracking-[0.08em] text-[var(--pw-text-primary)]">
          Needs you
        </p>
        <div className="flex items-baseline justify-between gap-[var(--pw-spacing-sm)]">
          <h3
            id={headingId}
            className="text-[length:var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)]"
          >
            {name}
          </h3>
          <StatusWord row={row} />
        </div>
        {first && (
          <>
            <p className="font-semibold text-[var(--pw-text-primary)]">{first.title}</p>
            <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
              {first.why}
            </p>
          </>
        )}
        <p className="text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
          {[
            needs.length > 1 ? plural(needs.length, "need", "needs") : null,
            first ? `waiting since ${formatTime(first.created_at)}` : null,
            changed > 0 ? `${changed} new since you last looked` : null,
            keeper ? `kept by ${keeper.name}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {row.error !== null && (
          <p className="text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
            {`Couldn't read all of its needs: ${row.error}`}
          </p>
        )}
        {markSeen.isError && (
          <p role="alert" className="text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-secondary)]">
            Couldn't mark that as seen. It's still waiting.
          </p>
        )}
        <div className="mt-auto flex flex-wrap gap-[var(--pw-spacing-sm)] pt-[var(--pw-spacing-sm)]">
          <OpenLink row={row} primary />
          {first && (
            <button
              type="button"
              disabled={markSeen.isPending}
              onClick={() => markSeen.mutate({ roomId: row.id, needId: first.id })}
              aria-label={`Mark “${first.title}” as seen`}
              className={`${LINK_BASE} border border-[var(--pw-border-subtle)] bg-transparent text-[var(--pw-text-primary)] disabled:opacity-60`}
            >
              {markSeen.isPending ? "Marking…" : "Mark as seen"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Corridor (everything else) ──────────────────────────────────────

function CorridorRow({
  row,
  showInteriors,
  keeper,
}: {
  row: RoomRow;
  showInteriors: boolean;
  keeper: RoomKeeper | null;
}) {
  const name = roomName(row);
  const doorways = useDoorwayChoices();
  const interior = showInteriors ? interiorUrl(row.id, doorways[row.id]) : null;
  const dim = isUncertain(row);
  return (
    <li className="flex flex-wrap items-center gap-[var(--pw-spacing-md)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)]">
      {interior ? (
        <img
          src={interior}
          alt=""
          aria-hidden="true"
          className={`h-14 w-auto shrink-0 ${dim ? "opacity-60 saturate-50" : ""}`}
        />
      ) : (
        <Emblem row={row} keeper={keeper} size="sm" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-[var(--pw-spacing-sm)]">
          <h3 className="text-[length:var(--pw-typography-size_small)] font-semibold text-[var(--pw-text-primary)]">
            {name}
          </h3>
          <StatusWord row={row} />
        </div>
        <p className="text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
          {detailLine(row)}
        </p>
        {row.reachable && row.error !== null && (
          <p className="text-[length:var(--pw-typography-size_micro)] text-[var(--pw-text-muted)]">
            {`Couldn't read its needs: ${row.error}`}
          </p>
        )}
      </div>
      <OpenLink row={row} />
    </li>
  );
}

function CorridorGroup({
  title,
  rows,
  showInteriors,
  showKeepers,
}: {
  title: string;
  rows: RoomRow[];
  showInteriors: boolean;
  showKeepers: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-[var(--pw-spacing-sm)]">
      <h3 className="text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.12em] text-[var(--pw-text-muted)]">
        {title} · {rows.length}
      </h3>
      <ul className="flex flex-col gap-[var(--pw-spacing-sm)]">
        {rows.map((row) => (
          <CorridorRow
            key={row.id}
            row={row}
            showInteriors={showInteriors}
            keeper={showKeepers ? (row.keeper ?? null) : null}
          />
        ))}
      </ul>
    </div>
  );
}

// ─── The panel ───────────────────────────────────────────────────────

export function RoomsPanel() {
  const rooms = useRooms();
  const rows = rooms.data?.data;
  const showInteriors = useRootAttribute("data-theme") === "doorways";
  const showKeepers = useRootAttribute("data-pw-personality-pack") === "residents";
  // null = follow the default (open only when nothing needs you).
  const [quietChoice, setQuietChoice] = useState<boolean | null>(null);

  return (
    <section
      aria-labelledby="rooms-heading"
      className="bridge-rooms flex flex-col gap-[var(--pw-spacing-lg)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-lg)]"
    >
      <h2
        id="rooms-heading"
        className="text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.16em] text-[var(--pw-text-muted)]"
      >
        Rooms
      </h2>

      {rooms.isPending ? (
        <div className="flex flex-col gap-[var(--pw-spacing-md)]">
          <div aria-hidden="true" className="flex gap-[var(--pw-spacing-md)]">
            {[0, 1].map((i) => (
              <span
                key={i}
                className="h-32 w-24 rounded-t-full rounded-b-[var(--pw-radius-md)] border-2 border-dashed border-[var(--pw-border-subtle)]"
              />
            ))}
          </div>
          <p role="status" className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-muted)]">
            Checking your rooms…
          </p>
        </div>
      ) : rooms.isError || rows === undefined ? (
        <div className="flex flex-col items-start gap-[var(--pw-spacing-sm)]">
          <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
            Couldn't check your rooms right now. Nothing here is invented.
          </p>
          <button
            type="button"
            onClick={() => void rooms.refetch()}
            className={`${LINK_BASE} border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] text-[var(--pw-text-primary)]`}
          >
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          No rooms are set up yet. When a room connects, its door appears here.
        </p>
      ) : (
        <RoomsBody
          rows={rows}
          resume={rooms.data?.resume ?? null}
          summary={rooms.data?.summary}
          showInteriors={showInteriors}
          showKeepers={showKeepers}
          quietChoice={quietChoice}
          onToggleQuiet={(open) => setQuietChoice(open)}
        />
      )}
    </section>
  );
}

function RoomsBody({
  rows,
  resume,
  summary: serverSummary,
  showInteriors,
  showKeepers,
  quietChoice,
  onToggleQuiet,
}: {
  rows: RoomRow[];
  resume: RoomsResume | null;
  summary: RoomsSummary | undefined;
  showInteriors: boolean;
  showKeepers: boolean;
  quietChoice: boolean | null;
  onToggleQuiet: (open: boolean) => void;
}) {
  const now = useMinuteClock();
  const groups = groupRooms(rows);
  const needingCount = groups.doorways.length + groups.alsoNeeds.length;
  const quietOpen = quietChoice ?? needingCount === 0;

  const summary = [
    needingCount > 0
      ? `${plural(needingCount, "room needs", "rooms need")} you`
      : "Nothing needs you right now",
    serverSummary && serverSummary.changed > 0
      ? `${serverSummary.changed} new since you last looked`
      : null,
    groups.uncertain.length > 0 ? `${groups.uncertain.length} unknown or unreachable` : null,
    serverSummary && serverSummary.unknown > 0
      ? `${plural(serverSummary.unknown, "need", "needs")} we can't check right now`
      : null,
    groups.quiet.length > 0 ? `${groups.quiet.length} quiet` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const newestCheck = Math.max(
    ...rows.map((r) => new Date(r.checked_at).getTime()).filter((t) => !Number.isNaN(t)),
  );
  const stale = Number.isFinite(newestCheck) && now > 0 && now - newestCheck > STALE_AFTER_MS;

  return (
    <>
      <p className="-mt-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
        {summary}.
      </p>

      <ResumeLine resume={resume} rows={rows} showKeepers={showKeepers} />

      {stale && (
        <p className="rounded-[var(--pw-radius-sm)] border border-dashed border-[var(--pw-text-muted)] p-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
          {`Last checked ${formatTime(new Date(newestCheck).toISOString())}. You're seeing what the rooms said then.`}
        </p>
      )}

      {groups.doorways.length > 0 && (
        <div className="grid grid-cols-1 gap-[var(--pw-spacing-lg)] min-[600px]:grid-cols-2 min-[1100px]:grid-cols-3">
          {groups.doorways.map((row) => (
            <Doorway
              key={row.id}
              row={row}
              showInteriors={showInteriors}
              keeper={showKeepers ? (row.keeper ?? null) : null}
            />
          ))}
        </div>
      )}

      <CorridorGroup title="Also needs you" rows={groups.alsoNeeds} showInteriors={showInteriors} showKeepers={showKeepers} />
      <CorridorGroup title="Unknown or unreachable" rows={groups.uncertain} showInteriors={showInteriors} showKeepers={showKeepers} />
      <CorridorGroup title="Other rooms" rows={groups.other} showInteriors={showInteriors} showKeepers={showKeepers} />

      {groups.quiet.length > 0 && (
        <div className="flex flex-col gap-[var(--pw-spacing-sm)]">
          <button
            type="button"
            aria-expanded={quietOpen}
            aria-controls="rooms-quiet"
            onClick={() => onToggleQuiet(!quietOpen)}
            className={`${LINK_BASE} self-start border border-[var(--pw-border-subtle)] bg-transparent text-[var(--pw-text-primary)]`}
          >
            {`${plural(groups.quiet.length, "quiet room", "quiet rooms")}, all healthy · ${quietOpen ? "Hide" : "Show"}`}
          </button>
          <ul id="rooms-quiet" hidden={!quietOpen} className="flex flex-col gap-[var(--pw-spacing-sm)]">
            {groups.quiet.map((row) => (
              <CorridorRow
                key={row.id}
                row={row}
                showInteriors={showInteriors}
                keeper={showKeepers ? (row.keeper ?? null) : null}
              />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * Where you left off: the last room you opened, in words, with a way
 * back. The keeper "kept your place" only when the personality pack is
 * on and that room has one — flavour on top of the same fact.
 */
function ResumeLine({
  resume,
  rows,
  showKeepers,
}: {
  resume: RoomsResume | null;
  rows: RoomRow[];
  showKeepers: boolean;
}) {
  if (!resume) return null;
  const row = rows.find((r) => r.id === resume.room_id);
  if (!row) return null;
  const name = roomName(row);
  const keeper = showKeepers ? row.keeper : null;
  const what = resume.title && resume.title !== name ? ` · ${resume.title}` : "";
  return (
    <p className="flex flex-wrap items-center gap-x-[var(--pw-spacing-md)] gap-y-[var(--pw-spacing-xs)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
      <span>
        {keeper
          ? `${keeper.name} kept your place in ${name}${what}`
          : `You were last in ${name}${what}`}
        {` · ${formatTime(resume.at)}`}
      </span>
      <OpenLink row={row} label={`Back to ${name}`} />
    </p>
  );
}
