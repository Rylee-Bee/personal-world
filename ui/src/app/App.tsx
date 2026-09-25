/**
 * App — Project Worlds vNext shell.
 *
 * Accessibility contract §5.1 canonical DOM order:
 *   skip-link → navigation → main → complementary
 *
 * Navigation is the contract's stable skeleton: the four landmarks
 * (Overview · Memory · Chat · Settings) render first, in a fixed
 * order, always — no theme, no server layout, and no personal
 * customization can move or hide them (PRODUCT-LANGUAGE.md, C3/Δ3).
 * Below them sit the person's own sections, ordered/hidden through
 * the existing GET /api/sections mechanism (see derivePersonalAreas,
 * src/data/types.ts).
 *
 * The shell is state-routed: no router exists, so every destination
 * activates through setActiveArea — nav buttons and Overview's
 * Explore tiles share that one path. There are no hrefs to URLs
 * nothing serves.
 *
 * Theme: first run defaults to Starfield (DEFAULT_THEME in prefs-dom);
 * any device choice wins and survives reloads via localStorage.
 * Atmosphere: starfield background + grid overlay from portfolio patterns.
 *
 * Status readouts are derived from the live /healthz probe — never hardcoded.
 */

import { useMemo, useState, useEffect } from "react";
import { Bridge } from "../screens/Bridge/Bridge";
import { Memory } from "../screens/Memory/Memory";
import { Interests } from "../screens/Interests/Interests";
import { Chat } from "../screens/Chat/Chat";
import { Settings } from "../screens/Settings/Settings";
import { WorldDrawer } from "../components/WorldDrawer";
import { WorldAreaLink } from "../components/WorldAreaLink";
import { useHealthz, usePrefs, usePrefsSchema, useSections } from "../data/hooks";
import { SKELETON_AREAS, derivePersonalAreas } from "../data/types";
import type { WorldArea, WorldAreaId } from "../data/types";
import { parsePrefsSchema, readPrefsValues } from "../screens/Settings/parse";
import {
  applyPrefsToDocument,
  applyThemeToDocument,
  DEFAULT_THEME,
  readStoredTheme,
} from "./prefs-dom";

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

/**
 * The two-tier navigation truth:
 *   skeleton — the fixed landmarks, a module constant by contract;
 *   personal — derived from the server's /api/sections layout, with
 *              known destinations tail-appended so navigation is
 *              never silently lost when the server goes quiet.
 * Before (and without) any server answer, personal falls back to the
 * default set in registry order.
 */
function useWorldAreas(): { skeleton: readonly WorldArea[]; personal: WorldArea[] } {
  const sectionsQuery = useSections();
  const serverSections = sectionsQuery.data?.data?.sections;
  const personal = useMemo(
    () => derivePersonalAreas(serverSections),
    [serverSections],
  );
  return { skeleton: SKELETON_AREAS, personal };
}

/** Server-truth presentation prefs, applied to <html> as the
 *  data-pw-* attributes + --pw-* variables that prefs.py defines and
 *  that the world.css prefs layer consumes. Re-applied whenever the
 *  query settles (boot, refetch, Settings apply) — so a reload comes
 *  up honoring the stored values before anything is clicked, exactly
 *  the station.js behaviour this rebuild was missing (C11's
 *  "prefs editable but not applied" row). */
function useApplyPrefsChrome(): void {
  const prefsQuery = usePrefs();
  const schemaQuery = usePrefsSchema();

  const values = useMemo(() => {
    if (
      prefsQuery.isPending ||
      prefsQuery.isError ||
      schemaQuery.isPending ||
      schemaQuery.isError
    ) {
      return null;
    }
    const { entries } = parsePrefsSchema(schemaQuery.data);
    if (entries.length === 0) return null; // nothing describable → touch nothing
    return readPrefsValues(prefsQuery.data, entries);
  }, [
    prefsQuery.isPending,
    prefsQuery.isError,
    prefsQuery.data,
    schemaQuery.isPending,
    schemaQuery.isError,
    schemaQuery.data,
  ]);

  useEffect(() => {
    if (values) applyPrefsToDocument(values);
  }, [values]);
}

export function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeArea, setActiveArea] = useState<WorldAreaId>("overview");
  const { skeleton, personal } = useWorldAreas();

  // Prefs chrome: server truth lands on the document (C12).
  useApplyPrefsChrome();

  // Theme: device-local by contract (the station has no theme-write
  // endpoint) — restore what this device chose; a first run with no
  // stored choice resolves to DEFAULT_THEME (starfield, 2026-09-25).
  useEffect(() => {
    applyThemeToDocument(readStoredTheme() ?? DEFAULT_THEME);
  }, []);

  function renderScreen() {
    switch (activeArea) {
      case "overview":
        // The Bridge is the home screen (area id stays "overview").
        // Overview.tsx remains in the repo but is no longer rendered.
        return (
          <Bridge
            onOpenArea={setActiveArea}
            onOpenAssistant={() => setDrawerOpen(true)}
          />
        );
      case "memory":
        return <Memory />;
      case "chat":
        return <Chat />;
      case "settings":
        return <Settings />;
      case "interests":
        return <Interests />;
      default: {
        // Honest placeholders for destinations whose screens the
        // station does not back yet (projects, systems).
        const label =
          [...skeleton, ...personal].find((a) => a.id === activeArea)?.label ??
          activeArea;
        return (
          <main
            id="main-content"
            aria-label={label}
            className="relative z-10 p-[var(--pw-spacing-xl)]"
          >
            <h1 className="text-[length:var(--pw-typography-size_h1)] font-semibold text-[var(--pw-text-primary)]">
              {label}
            </h1>
            <p className="mt-[var(--pw-spacing-xl)] text-[var(--pw-text-muted)]">
              This part of your world isn't open yet — nothing is hidden
              here, it simply isn't built.
            </p>
          </main>
        );
      }
    }
  }

  const navButton = (area: WorldArea) => (
    <li key={area.id}>
      <WorldAreaLink
        area={area}
        isActive={area.id === activeArea}
        onClick={() => setActiveArea(area.id)}
      />
    </li>
  );

  return (
    <div className="min-h-screen bg-[var(--pw-surface-canvas)]">
      {/* Atmosphere layers — aria-hidden, decorative */}
      <div className="starfield-bg" aria-hidden="true" />
      <div className="grid-overlay" aria-hidden="true" />

      {/* §2.6: skip link — first focusable element */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* §5.1: navigation — topbar pattern from starfield. The padding
          keeps chrome clear of notches and the home indicator (§2.7):
          top inset + the usual spacing on the inline sides. */}
      <header className="relative z-20 sticky top-0 flex items-center gap-[var(--pw-spacing-lg)] pt-[var(--pw-safe-area-inset-top)] pl-[calc(var(--pw-spacing-lg)_+_var(--pw-safe-area-inset-left))] pr-[calc(var(--pw-spacing-lg)_+_var(--pw-safe-area-inset-right))] min-h-[56px] border-b border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)]/90 backdrop-blur-md">
        {/* Brand — "The frontend is Worlds. Station is a theme." The
            old "Station vNext" chrome label retired with that rule. */}
        <div className="flex items-center gap-[var(--pw-spacing-sm)] shrink-0">
          <div className="w-8 h-8 rounded-full bg-[var(--pw-accent-primary)]/10 border border-[var(--pw-accent-primary)]/30 flex items-center justify-center">
            <span className="text-[var(--pw-accent-primary)] text-sm">✦</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--pw-text-primary)]">
              Project Worlds
            </p>
          </div>
        </div>

        {/* Nav — flex items get min-w-0 so the row can shrink to the
            viewport and scroll instead of widening the layout on phones
            (the mobile.css lesson: `.shell-main > * { min-width: 0 }`).
            Two lists, one bar: the pinned skeleton first, then the
            person's own sections behind a visible divider. */}
        <nav aria-label="World navigation" className="flex-1 min-w-0">
          {/* One horizontally scrollable row (the original min-w-0
              lesson: a nav that cannot shrink widens the layout on
              phones). The landmark group and the personal group are
              separate lists INSIDE that scroller — the divider
              between them is a boundary, not a second scrollbar. */}
          <div className="flex items-center gap-[var(--pw-spacing-md)] min-w-0 overflow-x-auto overscroll-x-contain">
            <ul
              aria-label="World landmarks"
              className="flex gap-[var(--pw-spacing-xs)] shrink-0"
            >
              {skeleton.map(navButton)}
            </ul>
            {personal.length > 0 && (
              <ul
                aria-label="Personal sections"
                className="flex gap-[var(--pw-spacing-xs)] shrink-0 border-l border-[var(--pw-border-subtle)] pl-[var(--pw-spacing-md)]"
              >
                {personal.map(navButton)}
              </ul>
            )}
          </div>
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
          The World Assistant isn't connected yet. When it is, it will
          speak here — nothing is shown until then.
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
    <div className="hidden md:flex items-center gap-0 text-[length:var(--pw-typography-size_micro)] font-mono uppercase tracking-[0.14em]">
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
    <footer className="relative z-20 sticky bottom-0 flex items-center gap-4 pt-[var(--pw-spacing-sm)] pb-[calc(var(--pw-spacing-sm)_+_var(--pw-safe-area-inset-bottom))] pl-[calc(var(--pw-spacing-lg)_+_var(--pw-safe-area-inset-left))] pr-[calc(var(--pw-spacing-lg)_+_var(--pw-safe-area-inset-right))] border-t border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)]/90 backdrop-blur-md">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span
          className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`}
          aria-hidden="true"
        />
        <p className="text-[length:var(--pw-typography-size_micro)] font-mono text-[var(--pw-text-secondary)] truncate">
          {line}
        </p>
      </div>
      <div className="hidden sm:flex gap-4 text-[length:var(--pw-typography-size_micro)] font-mono uppercase tracking-[0.14em] text-[var(--pw-text-muted)]">
        <span>Project Worlds</span>
      </div>
    </footer>
  );
}
