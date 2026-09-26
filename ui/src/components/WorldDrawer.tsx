/**
 * WorldDrawer — Non-modal contextual detail/provenance panel.
 *
 * Accessibility contract §3.1:
 *   - Non-modal: background remains interactive → native <dialog> with
 *     show(), NOT showModal() (showModal would trap focus and mark the
 *     background inert, violating the contract).
 *   - Focus moves into drawer on open (native focus fixup on show()).
 *   - Escape closes (document keydown while open — non-modal dialogs
 *     are not auto-dismissed by the browser).
 *   - Focus returns to invoking control (tracked here; native <dialog>
 *     does not restore focus on close()).
 *
 * Native dialog semantics (a11y contract §3.6).
 */

import { Icon } from "./Icon";
import { useEffect, useRef } from "react";

interface WorldDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function WorldDrawer({
  isOpen,
  onClose,
  title,
  children,
}: WorldDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        // Capture the trigger BEFORE show() moves focus into the dialog.
        // Guard on dialog.open so a StrictMode re-run does not overwrite
        // the remembered trigger with an element inside the drawer.
        previousFocusRef.current = document.activeElement as HTMLElement | null;
        dialog.show(); // non-modal: no focus trap, background stays live
      }
      // Ensure focus is inside even when no descendant takes the native
      // focus fixup (e.g. drawer contains no controls yet).
      if (!dialog.contains(document.activeElement)) {
        dialog.focus();
      }

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      };
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }

    if (dialog.open) {
      dialog.close();
    }
    previousFocusRef.current?.focus();
    previousFocusRef.current = null;
  }, [isOpen, onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="world-drawer-title"
      tabIndex={-1}
      className="fixed right-0 top-0 z-40 m-0 h-full max-h-full w-full max-w-md overflow-y-auto border-l border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] pt-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-top))] pr-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-right))] pb-[calc(var(--pw-spacing-xl)_+_var(--pw-safe-area-inset-bottom))] pl-[var(--pw-spacing-xl)] text-[var(--pw-text-primary)] shadow-[var(--pw-shadow-soft)] open:flex open:flex-col"
    >
      <div className="mb-[var(--pw-spacing-lg)] flex items-center justify-between">
        <h2
          id="world-drawer-title"
          className="text-[length:var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)]"
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] items-center justify-center rounded-[var(--pw-radius-sm)] text-[var(--pw-text-secondary)] hover:bg-[var(--pw-accent-teal_soft)] hover:text-[var(--pw-text-primary)]"
          aria-label="Close drawer"
        >
          <Icon name="close" size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
