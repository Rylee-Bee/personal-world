/**
 * App — Project Worlds vNext shell.
 *
 * Accessibility contract §5.1 canonical DOM order:
 *   skip-link → navigation → main → complementary
 *
 * Theme: defaults to Station. Set data-theme="starfield" on <html> to switch.
 * Atmosphere: starfield background + grid overlay from portfolio patterns.
 *
 * Status readouts are derived from the live /healthz probe — never hardcoded.
 */

import { useMemo, useState } from "react";
import { Today } from "../screens/Today/Today";
import { Journal } from "../screens/Journal/Journal";
import { Vault } from "../screens/Vault/Vault";
import { Settings } from "../screens/Settings/Settings";
import { Chat } from "../screens/Chat/Chat";
import { WorldDrawer } from "../components/WorldDrawer";
import { WorldAreaLink } from "../components/WorldAreaLink";
import { useHealthz, useSections } from "../data/hooks";
import { WORLD_AREAS } from "../data/types";
import type { WorldArea, WorldAreaId } from "../data/types";

type HealthWord = "Checking" | "Online" | "Degraded" | "Unreachable";

function healthWord(state: {
  isError: boolean;
  isPending: boolean;
  data?: { ok?: boolean };
}): HealthWord {
  if (state.isError) return "Unreachable";
  if (state.isPending) return "Checking";
  if (state.data?.ok === false) return "Degraded";
  return "Online";
}

/** Server-ordered world areas; falls back to the default set until (and
 * unless) /api/sections returns something that maps onto known areas. */
function useWorldAreas(): WorldArea[] {
  const sectionsQuery = useSections();
  const serverSections = sectionsQuery.data?.data?.sections;
  return useMemo(() => {
    if (!serverSections || serverSections.length === 0) return WORLD_AREAS;
    const byId = new Map<string, WorldArea>(WORLD_AREAS.map((a) => [a.id, a]));
    const ordered = [...serverSections]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .flatMap((s) => {
        // Server ids the UI has no destination for (media, lab, vault,
        // chat) are skipped; the tail-append below guarantees no known
        // area is ever silently lost.
        const area = byId.get(s.id);
        return area && s.visible !== false ? [area] : [];
      });
    // Never silently lose navigation destinations the server hasn't seen.
    const seen = new Set(ordered.map((a) => a.id));
    return [...ordered, ...WORLD_AREAS.filter((a) => !seen.has(a.id))];
  }, [serverSections]);
}

export function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeArea, setActiveArea] = useState<WorldAreaId>("today");
  const areas = useWorldAreas();

  function renderScreen() {
    switch (activeArea) {
      case "today":
        return <Today onOpenAssistant={() => setDrawerOpen(true)} />;
      case "journal":
        return <Journal />;
      case "records":
        return <Vault />;
      case "settings":
        return <Settings />;
      case "news":
        return <Chat />;
      default: {
        const label = areas.find((a) => a.id === activeArea)?.label ?? activeArea;
        return (
          <main
            id="main-content"
            aria-label={label}
            className="relative z-10 p-[var(--pw-spacing-xl)]"
          >
            <h1 className="text-[var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]">
              {label}
            </h1>
            <p className="mt-[var(--pw-spacing-xl)] text-[var(--pw-text-muted)]">
              Coming soon.
            </p>
          </main>
        );
      }
    }
  }

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
            <p className="text-[var(--pw-typography-size_micro)] uppercase tracking-[0.16em] text-[var(--pw-text-muted)]">
              Station vNext
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav aria-label="World navigation" className="flex-1">
          <ul className="flex gap-[var(--pw-spacing-xs)] overflow-x-auto">
            {areas.map((area) => (
              <li key={area.id}>
                <WorldAreaLink
                  area={area}
                  isActive={area.id === activeArea}
                  onClick={() => setActiveArea(area.id)}
                />
              </li>
            ))}
          </ul>
        </nav>

        {/* Readout cells */}
        <HealthReadout />
      </header>

      {/* §5.1: main content — screen router */}
      {renderScreen()}

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
      <StatusStrip />
    </div>
  );
}

/** Header readout cells — status comes from the live /healthz probe. */
function HealthReadout() {
  const health = useHealthz();
  const word = healthWord(health);
  const wordColor =
    word === "Online"
      ? "text-[var(--pw-accent-green)]"
      : word === "Checking"
        ? "text-[var(--pw-text-secondary)]"
        : "text-[var(--pw-accent-warm)]";

  return (
    <div className="hidden md:flex items-center gap-0 text-[var(--pw-typography-size_micro)] font-mono uppercase tracking-[0.14em]">
      <div className="px-3 border-l border-[var(--pw-border-subtle)]">
        <p className="text-[var(--pw-text-muted)]">Status</p>
        <p className={wordColor} role="status" aria-live="polite">
          {word}
        </p>
      </div>
      <div className="px-3 border-l border-[var(--pw-border-subtle)]">
        <p className="text-[var(--pw-text-muted)]">Local</p>
        <p className="text-[var(--pw-text-secondary)]" suppressHydrationWarning>
          {new Date().toLocaleTimeString("en-US", { hour12: false })}
        </p>
      </div>
    </div>
  );
}

/** Footer strip — honest scanner state, same live probe. */
function StatusStrip() {
  const health = useHealthz();
  const word = healthWord(health);
  const line =
    word === "Online"
      ? "Scanner online. Select a world to begin."
      : word === "Checking"
        ? "Checking scanner…"
        : word === "Degraded"
          ? "Scanner degraded. Some worlds may be unreachable."
          : "Scanner unreachable. Showing nothing until the station answers.";
  const dotColor =
    word === "Online"
      ? "bg-[var(--pw-accent-teal)]"
      : word === "Checking"
        ? "bg-[var(--pw-text-muted)]"
        : "bg-[var(--pw-accent-warm)]";

  return (
    <footer className="relative z-20 sticky bottom-0 flex items-center gap-4 px-[var(--pw-spacing-lg)] py-2 border-t border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)]/90 backdrop-blur-md">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span
          className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`}
          aria-hidden="true"
        />
        <p className="text-[var(--pw-typography-size_micro)] font-mono text-[var(--pw-text-secondary)] truncate">
          {line}
        </p>
      </div>
      <div className="hidden sm:flex gap-4 text-[var(--pw-typography-size_micro)] font-mono uppercase tracking-[0.14em] text-[var(--pw-text-muted)]">
        <span>Project Worlds</span>
        <span>Station vNext</span>
      </div>
    </footer>
  );
}
