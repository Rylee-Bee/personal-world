/**
 * WorldDrawer — Non-modal contextual detail/provenance panel.
 *
 * Accessibility contract §3.1:
 *   - Non-modal: background remains interactive
 *   - Focus moves into drawer on open
 *   - Escape closes
 *   - Focus returns to invoking control
 *
 * Uses native dialog semantics (a11y contract §3.6).
 */

import { useEffect, useRef, useCallback } from "react";

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
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Remember who had focus before opening
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
  }, [isOpen]);

  // Escape handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  // Return focus on close
  useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={drawerRef}
      role="dialog"
      aria-label={title}
      onKeyDown={handleKeyDown}
      className="fixed right-0 top-0 z-40 h-full w-full max-w-md overflow-y-auto border-l border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-xl)] shadow-[var(--pw-shadow-soft)]"
      tabIndex={-1}
    >
      <div className="mb-[var(--pw-spacing-lg)] flex items-center justify-between">
        <h2 className="text-[var(--pw-typography-size_lead)] font-semibold text-[var(--pw-text-primary)]">
          {title}
        </h2>
        <button
          onClick={onClose}
          className="flex min-h-[var(--pw-targets-minimum)] min-w-[var(--pw-targets-minimum)] items-center justify-center rounded-[var(--pw-radius-sm)] text-[var(--pw-text-secondary)] hover:bg-[var(--pw-accent-teal_soft)] hover:text-[var(--pw-text-primary)]"
          aria-label="Close drawer"
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  );
}
