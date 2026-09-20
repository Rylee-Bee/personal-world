/**
 * App — Project Worlds vNext shell.
 *
 * Accessibility contract §5.1 canonical DOM order:
 *   skip-link → navigation → main → complementary
 *
 * Theme: defaults to Station. Set data-theme="starfield" on <html> to switch.
 * Atmosphere: starfield background + grid overlay from portfolio patterns.
 */

import { useState } from "react";
import { Today } from "../screens/Today/Today";
import { WorldDrawer } from "../components/WorldDrawer";
import { WorldAreaLink } from "../components/WorldAreaLink";
import { WORLD_AREAS } from "../data/types";

export function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--pw-surface-canvas)]">
      {/* Atmosphere layers — aria-hidden, decorative */}
      <div className="starfield-bg" aria-hidden="true" />
      <div className="grid-overlay" aria-hidden="true" />

      {/* §2.6: skip link — first focusable element */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* §5.1: navigation — topbar pattern from starfield */}
      <header className="relative z-20 sticky top-0 flex items-center gap-[var(--pw-spacing-lg)] px-[var(--pw-spacing-lg)] min-h-[56px] border-b border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)]/90 backdrop-blur-md">
        {/* Brand */}
        <div className="flex items-center gap-[var(--pw-spacing-sm)]">
          <div className="w-8 h-8 rounded-full bg-[var(--pw-accent-primary)]/10 border border-[var(--pw-accent-primary)]/30 flex items-center justify-center">
            <span className="text-[var(--pw-accent-primary)] text-sm">✦</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--pw-text-primary)]">
              Project Worlds
            </p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
              Station vNext
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav aria-label="World navigation" className="flex-1">
          <ul className="flex gap-[var(--pw-spacing-xs)] overflow-x-auto">
            {WORLD_AREAS.map((area) => (
              <li key={area.id}>
                <WorldAreaLink area={area} isActive={area.id === "today"} />
              </li>
            ))}
          </ul>
        </nav>

        {/* Readout cells */}
        <div className="hidden md:flex items-center gap-0 text-[10px] font-mono uppercase tracking-[0.14em]">
          <div className="px-3 border-l border-[var(--pw-border-subtle)]">
            <p className="text-[var(--pw-text-muted)]">Status</p>
            <p className="text-[var(--pw-accent-green)]">Online</p>
          </div>
          <div className="px-3 border-l border-[var(--pw-border-subtle)]">
            <p className="text-[var(--pw-text-muted)]">Local</p>
            <p className="text-[var(--pw-text-secondary)]" suppressHydrationWarning>
              {new Date().toLocaleTimeString("en-US", { hour12: false })}
            </p>
          </div>
        </div>
      </header>

      {/* §5.1: main content */}
      <Today onOpenAssistant={() => setDrawerOpen(true)} />

      {/* §3.1: provenance drawer — non-modal */}
      <WorldDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="World Assistant"
      >
        <p className="text-[var(--pw-text-secondary)]">
          The World Assistant will appear here.
        </p>
      </WorldDrawer>

      {/* Status strip — bottom bar pattern from starfield */}
      <footer className="relative z-20 sticky bottom-0 flex items-center gap-4 px-[var(--pw-spacing-lg)] py-2 border-t border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)]/90 backdrop-blur-md">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="h-2 w-2 rounded-full bg-[var(--pw-accent-teal)] shrink-0 shadow-[0_0_8px_rgba(90,168,184,0.4)]" aria-hidden="true" />
          <p className="text-[11px] font-mono text-[var(--pw-text-secondary)] truncate">
            Scanner online. Select a world to begin.
          </p>
        </div>
        <div className="hidden sm:flex gap-4 text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--pw-text-muted)]">
          <span>Project Worlds</span>
          <span>Station vNext</span>
        </div>
      </footer>
    </div>
  );
}
