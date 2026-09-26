/**
 * "How rooms connect" — a plain, in-app explainer (owner, 2026-09-26),
 * behind a disclosure button so it never crowds the page. Used by the
 * Bridge's first-day guide and by the Rooms panel when no rooms exist.
 */
import { useId, useState } from "react";
import { LINK_BASE } from "./format";

export function RoomsExplainer() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="flex flex-col items-start gap-[var(--pw-spacing-sm)]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={`${LINK_BASE} border border-[var(--pw-border-subtle)] bg-transparent text-[var(--pw-text-primary)]`}
      >
        How rooms connect
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="max-w-[62ch] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)] p-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]"
      >
        <p>
          A room is a small app on your server, like Workshop or Studio, that
          speaks the room contract (room/0). Worlds shows what a room reports;
          it never changes a room itself.
        </p>
        <p className="mt-[var(--pw-spacing-sm)]">
          Worlds finds rooms through its room list: the room registry Project
          Home keeps, or the <code>PW_ROOMS</code> setting on your server (for
          example <code>workshop=http://workshop:8080</code>). A room added to the
          registry appears on the next check, within a minute; a change to{" "}
          <code>PW_ROOMS</code> takes effect after a restart.
        </p>
      </div>
    </div>
  );
}
