/**
 * Pieces shared by the Rooms panel and the room drawer: the Open link
 * (which records a visit), the status word, and a room's emblem.
 */
import { useVisitRoom } from "../../data/hooks";
import type { RoomKeeper, RoomRow } from "../../data/contract";
import { CompanionFace } from "../crew/CompanionFace";
import { keeperPortraitUrl } from "./crew";
import { initial, LINK_BASE, roomAddress, roomItemUrl, roomName, statusWord } from "./format";
import { isUncertain } from "./groupRooms";
import { useRoomDrawer } from "./drawerContext";

/**
 * Opens a room in a new tab, and that is the visit. With `item`, it opens
 * the exact thing instead: the item's `link` is a path on the ROOM's own
 * site, resolved against the room's address (never a Worlds path), and
 * the visit remembers it so "Back to …" returns there. A link that fails
 * the same-origin rules falls back to the room's front door.
 */
export function OpenLink({
  row,
  primary = false,
  label,
  item,
}: {
  row: RoomRow;
  primary?: boolean;
  label?: string;
  item?: { title?: string | null; link?: string | null };
}) {
  const name = roomName(row);
  const visit = useVisitRoom();
  const itemHref = item ? roomItemUrl(row, item.link) : null;
  return (
    <a
      href={itemHref ?? roomAddress(row)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label ?? `Open ${name}`} in a new tab`}
      // Opening a room is the visit. Recorded after the tab opens, never
      // in its way; a failed write only leaves the old baseline.
      onClick={() =>
        visit.mutate({
          roomId: row.id,
          title: (itemHref && item?.title) || name,
          ...(itemHref && item?.link ? { link: item.link } : {}),
        })
      }
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

export function StatusWord({ row }: { row: RoomRow }) {
  return (
    <span className="shrink-0 text-[length:var(--pw-typography-size_micro)] font-medium text-[var(--pw-text-secondary)]">
      {row.reachable || row.status === "incompatible"
        ? statusWord(row.status)
        : "Unreachable"}
    </span>
  );
}

/** A room's face: its keeper (pack on) — their picture, or the crew
 *  commbadge with their initial — or, with no keeper, the room's own
 *  initial in a lantern ring. */
export function Emblem({
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


/** Opens the room drawer; says which room, and that it opens a panel. */
export function LookInside({ row }: { row: RoomRow }) {
  const drawer = useRoomDrawer();
  const name = roomName(row);
  const isOpen = drawer.openRoomId === row.id;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-label={`Look inside ${name}`}
      onClick={(e) => drawer.open(row.id, e.currentTarget)}
      className={`${LINK_BASE} border border-[var(--pw-border-subtle)] bg-transparent text-[var(--pw-text-primary)] ${
        isOpen ? "border-[var(--pw-accent-warm)]" : ""
      }`}
    >
      Look inside
    </button>
  );
}
