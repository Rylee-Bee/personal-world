import * as React from "react";
import { useCompanion, COMPANIONS } from "../lib/companion-context";

/**
 * CompanionPopover (Workshop v3 frame 17:4565, focus state):
 *
 * Non-modal popover that appears beside the sidebar rail companion —
 * the "She has something to say" intermediate disclosure level between
 * rest (quietly here) and open (full World Assistant drawer).
 *
 * Shows: companion artwork (36px), "Your world is quiet today" status,
 * "Nothing needs you right now." voice text, "Open assistant" button,
 * and keyboard guidance. Escape closes, click outside dismisses,
 * focus returns to the trigger.
 *
 * A11y: non-modal, Escape to close, focus contained. The popover is
 * not a dialog — it is a supplementary information surface. The
 * "Open assistant" button carries the primary action. Keyboard
 * guidance is decorative (aria-hidden).
 */

export interface CompanionPopoverProps {
  open: boolean;
  onClose: () => void;
  onOpenAssistant: () => void;
  /** Test/SSR seam: overrides the companion pref. */
  companion?: string | null;
  /** Section label for context line (e.g. "Today"). */
  contextLabel?: string;
  /** Status text shown in the popover greeting. */
  statusText?: string;
}

let popoverSequence = 0;

export function CompanionPopover({
  open,
  onClose,
  onOpenAssistant,
  companion: companionOverride,
  contextLabel: _contextLabel,
  statusText = "Your world is running.",
}: CompanionPopoverProps) {
  const context = useCompanion();
  const companion = companionOverride !== undefined ? companionOverride : context.companion;
  const panelRef = React.useRef<HTMLDivElement>(null);
  const triggerRestoreRef = React.useRef<HTMLElement | null>(null);
  const idRef = React.useRef<string>(null);
  if (idRef.current === null) {
    popoverSequence += 1;
    idRef.current = `pw-companion-popover-${popoverSequence}`;
  }
  const id = idRef.current;

  const artworkVisible = companion !== "off" && companion !== null;
  const baseName = companion && COMPANIONS[companion] ? companion : "personal-world";

  // Escape to close (A11y contract for focus state)
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  // Light dismiss: pointerdown outside closes
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: Event) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (!target.closest(`#${id}`) && !target.closest("[data-pw-companion-mode='rest']")) {
        onClose();
      }
    };
    // Delay to avoid the opening click from immediately closing
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, onClose, id]);

  // Focus management: move focus into popover when opened, restore on close
  React.useEffect(() => {
    if (open) {
      triggerRestoreRef.current = document.activeElement as HTMLElement;
      // Focus the "Open assistant" button
      const btn = panelRef.current?.querySelector("[data-pw-popover-action]") as HTMLElement;
      btn?.focus();
    } else {
      const restore = triggerRestoreRef.current;
      triggerRestoreRef.current = null;
      if (restore && document.contains(restore) && !restore.closest("[inert]")) {
        try { restore.focus(); } catch { /* focus stays put */ }
      }
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      id={id}
      ref={panelRef}
      role="group"
      aria-label="Companion message"
      data-pw-companion-popover=""
      data-pw-popover-open={open ? "true" : "false"}
      className="pw-companion-popover"
    >
      <div className="pw-companion-popover-pointer" aria-hidden="true" />
      <div className="pw-companion-popover-content">
        <div className="pw-companion-popover-intro">
          {artworkVisible ? (
            <span aria-hidden="true" className="pw-companion-popover-artwork">
              <img
                src={`/companions/${baseName}.svg`}
                alt=""
                width={36}
                height={36}
                className="block"
              />
            </span>
          ) : null}
          <div className="pw-companion-popover-status">
            <p className="pw-companion-popover-greeting">
              {statusText}{" "}
              <span className="pw-companion-popover-spark" aria-hidden="true">✦</span>
            </p>
            <p className="pw-companion-popover-voice">
              "Nothing needs you right now."
            </p>
          </div>
        </div>
        <button
          type="button"
          data-pw-popover-action=""
          onClick={onOpenAssistant}
          className="pw-companion-popover-action"
        >
          Open assistant
        </button>
        <div className="pw-companion-popover-hint" aria-hidden="true">
          <span>World assistant — open to chat</span>
          <span>Press Enter to open</span>
        </div>
      </div>
    </div>
  );
}
