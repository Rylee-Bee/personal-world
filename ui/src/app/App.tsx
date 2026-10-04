/**
 * App — the Worlds shell.
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

import { noteCurrentArea, takeConfirmReturn } from "./confirmReturn";
import { areaFromHash, setAddress } from "./areaAddress";
import { WorldButton } from "../components/WorldButton";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { Bridge } from "../screens/Bridge/Bridge";
import { Memory } from "../screens/Memory/Memory";
import { Chat, type ChatDraft } from "../screens/Chat/Chat";
import { AskInChatContext } from "./askInChat";
import { Settings } from "../screens/Settings/Settings";
import { Crew } from "../screens/Crew/Crew";
import { People } from "../screens/People/People";
import { Helpers } from "../screens/Helpers/Helpers";
import { RoughNight } from "../screens/RoughNight/RoughNight";
import { Library } from "../screens/Library/Library";
import { Icon } from "../components/Icon";
import { RememberForm } from "../components/remember/RememberForm";
import { Lore } from "../screens/Lore/Lore";
import { AtHome } from "../screens/AtHome/AtHome";
import { Stickers } from "../screens/Stickers/Stickers";
import { StickerLanding } from "../components/stickers/StickerLanding";
import { SolTaps } from "../components/stickers/SolTaps";
import { reportSticker } from "../components/stickers/report";
import { Computers } from "../screens/Computers/Computers";
import { Projects } from "../screens/Projects/Projects";
import { StayFresh } from "./StayFresh";
import { ShareSheet } from "./ShareSheet";
import { WorldDrawer } from "../components/WorldDrawer";
import { WorldAreaLink } from "../components/WorldAreaLink";
import {
  useHealthz,
  usePrefs,
  usePrefsSchema,
  useRoomEvents,
  useSections,
  useSession,
} from "../data/hooks";
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
  // Remember: one tap from every page. (Something shared from the phone's
  // Share sheet is offered by <ShareSheet />.)
  const [rememberOpen, setRememberOpen] = useState(false);
  // Rooms refresh the moment one says it changed (two-way rooms).
  useRoomEvents();
  // "crew" and "people" are pages inside Settings, not nav landmarks:
  // the skeleton stays Overview · Memory · Chat · Settings.
  // Coming back from "Confirm with your sign-in" reopens the page the
  // person was on, with one line saying they're confirmed.
  const [returned] = useState(() => takeConfirmReturn());
  // "rough-night" joins those quiet pages: a plain page of its own,
  // reached by small links from the Bridge and Settings — never a nav
  // landmark. Every screen has an address (#memory, #library…): the page
  // opened from an address wins over the Bridge on load.
  const [activeArea, setActiveArea] = useState<
    WorldAreaId | "crew" | "people" | "helpers" | "rough-night" | "library" | "lore" | "at-home" | "stickers"
  >(
    () =>
      (returned as
        | WorldAreaId
        | "crew"
        | "people"
        | "helpers"
        | "rough-night"
        | "library"
        | "lore"
        | "at-home"
        | "stickers"
        | null) ??
      areaFromHash(window.location.hash) ??
      "overview",
  );
  // Keep the address in step: a new history entry per screen change (so
  // back/forward work), and the address followed when it changes.
  // (After back/forward the address already matches, so nothing is pushed.)
  const firstAddress = useRef(true);
  useEffect(() => {
    setAddress(activeArea, firstAddress.current ? "replace" : "push");
    firstAddress.current = false;
  }, [activeArea]);
  useEffect(() => {
    const follow = () => {
      // An unknown or empty address is the Bridge, the same as on load.
      setActiveArea(areaFromHash(window.location.hash) ?? "overview");
    };
    window.addEventListener("popstate", follow);
    window.addEventListener("hashchange", follow);
    return () => {
      window.removeEventListener("popstate", follow);
      window.removeEventListener("hashchange", follow);
    };
  }, []);
  // The Library is another quiet page; Back returns to wherever it was opened.
  const [libraryFrom, setLibraryFrom] = useState<"settings" | "overview">("settings");
  const openLibrary = useCallback((from: "settings" | "overview") => {
    setLibraryFrom(from);
    setActiveArea("library");
  }, []);
  // Your lore: a quiet page too, opened from Memory or Settings.
  const [loreFrom, setLoreFrom] = useState<"memory" | "settings">("memory");
  const openLore = useCallback((from: "memory" | "settings") => {
    setLoreFrom(from);
    setActiveArea("lore");
  }, []);
  // The banner only ever proves a person clicked "Confirm with your
  // sign-in" — it says nothing about whether the step-up actually
  // succeeded server-side. Gate it on real session truth (has_step_up)
  // rather than the mere presence of the return marker, so it auto-clears
  // if step-up never landed or later lapses; a manual Dismiss also hides
  // it without waiting for the server to disagree.
  const sessionQuery = useSession();
  const [confirmedNoteDismissed, setConfirmedNoteDismissed] = useState(false);
  const confirmedNote =
    returned !== null && sessionQuery.data?.data?.has_step_up === true && !confirmedNoteDismissed;
  useEffect(() => {
    noteCurrentArea(activeArea);
    // Finding Rough night is a sticker (using it never is). Reported here,
    // so the page itself sends nothing but the note the person saves.
    if (activeArea === "rough-night") void reportSticker("soft-landing");
  }, [activeArea]);
  const [chatDraft, setChatDraft] = useState<ChatDraft | null>(null);
  const askInChat = useCallback((question: string) => {
    setChatDraft({ id: Date.now(), text: question });
    setActiveArea("chat");
  }, []);
  const { skeleton, personal } = useWorldAreas();

  // A secret sticker for opening Worlds at 11:11 in the morning.
  useEffect(() => {
    const now = new Date();
    if (now.getHours() === 11 && now.getMinutes() === 11) void reportSticker("make-a-wish");
  }, []);

  // Prefs chrome: server truth lands on the document (C12).
  useApplyPrefsChrome();

  // Theme: device-local by contract (the station has no theme-write
  // endpoint) — restore what this device chose; a first run with no
  // stored choice resolves to DEFAULT_THEME (starfield, 2026-09-25).
  useEffect(() => {
    applyThemeToDocument(readStoredTheme() ?? DEFAULT_THEME);
  }, []);

  // After moving to another page, put focus on its heading so keyboard
  // and screen-reader users start at the top of what they chose (the
  // walkthrough's open question). Not on first load, and not when the new
  // page already placed focus itself (Ask in Chat focuses the message box).
  const firstArea = useRef(true);
  useEffect(() => {
    if (firstArea.current) {
      firstArea.current = false;
      return;
    }
    const main = document.getElementById("main-content");
    if (!main || main.contains(document.activeElement)) return;
    const heading = main.querySelector<HTMLElement>("h1");
    if (!heading) return;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: false });
  }, [activeArea]);

  function renderScreen() {
    switch (activeArea) {
      case "overview":
        // The Bridge is the home screen (area id stays "overview").
        return (
          <Bridge
            onOpenArea={setActiveArea}
            onOpenAssistant={() => setDrawerOpen(true)}
            onOpenCrew={() => setActiveArea("crew")}
            onOpenRoughNight={() => setActiveArea("rough-night")}
            onOpenLibrary={() => openLibrary("overview")}
            onOpenStickers={() => setActiveArea("stickers")}
          />
        );
      case "memory":
        return <Memory onOpenLore={() => openLore("memory")} />;
      case "chat":
        return <Chat key={chatDraft?.id ?? "chat"} draft={chatDraft} />;
      case "settings":
        return (
          <Settings
            onOpenCrew={() => setActiveArea("crew")}
            onOpenPeople={() => setActiveArea("people")}
            onOpenHelpers={() => setActiveArea("helpers")}
            onOpenRoughNight={() => setActiveArea("rough-night")}
            onOpenLibrary={() => openLibrary("settings")}
            onOpenLore={() => openLore("settings")}
            onOpenStickers={() => setActiveArea("stickers")}
          />
        );
      case "crew":
        return <Crew onBack={() => setActiveArea("settings")} />;
      case "people":
        return <People onBack={() => setActiveArea("settings")} />;
      case "helpers":
        return <Helpers onBack={() => setActiveArea("settings")} />;
      case "rough-night":
        return <RoughNight onBack={() => setActiveArea("overview")} />;
      case "library":
        return (
          <Library
            onBack={() => setActiveArea(libraryFrom)}
            backLabel={libraryFrom === "overview" ? "Back to the Bridge" : "Back to Settings"}
          />
        );
      case "lore":
        return (
          <Lore
            onBack={() => setActiveArea(loreFrom)}
            backLabel={loreFrom === "settings" ? "Back to Settings" : "Back to Memory"}
          />
        );
      case "at-home":
        return <AtHome onBack={() => setActiveArea("overview")} />;
      case "stickers":
        return <Stickers />;
      case "projects":
        return <Projects />;
      case "systems":
        return <Computers />;
      default: {
        // Honest placeholders for destinations whose screens the
        // station does not back yet (systems).
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
        isActive={
          area.id === activeArea ||
          ((activeArea === "crew" || activeArea === "people" || activeArea === "helpers") && area.id === "settings")
        }
        onClick={() => setActiveArea(area.id)}
      />
    </li>
  );

  return (
    <AskInChatContext.Provider value={askInChat}>
    <div className="min-h-screen bg-[var(--pw-surface-canvas)]">
      {/* Atmosphere layers — aria-hidden, decorative */}
      <div className="starfield-bg" aria-hidden="true" />
      <div className="grid-overlay" aria-hidden="true" />

      {/* §2.6: skip link — first focusable element */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* A newer build is live: reload on return, or say so quietly. */}
      <StayFresh />
      {/* Shared from the phone's Share sheet: keep it in one tap. */}
      <ShareSheet />

      {/* §5.1: navigation — topbar pattern from starfield. The padding
          keeps chrome clear of notches and the home indicator (§2.7):
          top inset + the usual spacing on the inline sides. */}
      <header className="relative z-20 sticky top-0 flex items-center gap-[var(--pw-spacing-lg)] max-sm:flex-wrap max-sm:gap-y-0 pt-[var(--pw-safe-area-inset-top)] pl-[calc(var(--pw-spacing-lg)_+_var(--pw-safe-area-inset-left))] pr-[calc(var(--pw-spacing-lg)_+_var(--pw-safe-area-inset-right))] min-h-[56px] border-b border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)]/90 backdrop-blur-md">
        {/* Brand — "The frontend is Worlds. Station is a theme." The
            old "Station vNext" chrome label retired with that rule. */}
        <div className="flex items-center gap-[var(--pw-spacing-sm)] shrink-0">
          <SolTaps />
          <div className="hidden sm:block">
            <p className="text-[length:var(--pw-typography-size_label)] font-semibold uppercase tracking-[0.14em] text-[var(--pw-text-primary)]">
              Worlds
            </p>
          </div>
        </div>

        {/* Nav — flex items get min-w-0 so the row can shrink to the
            viewport and scroll instead of widening the layout on phones
            (the mobile.css lesson: `.shell-main > * { min-width: 0 }`).
            Two lists, one bar: the pinned skeleton first, then the
            person's own sections behind a visible divider. */}
        {/* Phones: the nav takes its own full-width row under the mark and
            Remember. Sharing one row, Settings slid under the Remember
            button and couldn't be tapped (UAT 2026-09-27), which also cut
            the way to Rough night. */}
        <nav aria-label="World navigation" className="flex-1 min-w-0 max-sm:order-last max-sm:basis-full">
          {/* One horizontally scrollable row (the original min-w-0
              lesson: a nav that cannot shrink widens the layout on
              phones). The landmark group and the personal group are
              separate lists INSIDE that scroller — the divider
              between them is a boundary, not a second scrollbar. */}
          {/* Phones: the personal sections wrap onto their own row, so
              nothing hides past the edge of a scroller with no hint. From
              640px up it is one row again. */}
          <div className="flex flex-wrap items-center gap-x-[var(--pw-spacing-md)] gap-y-[var(--pw-spacing-xs)] min-w-0 py-[var(--pw-spacing-xs)] sm:flex-nowrap sm:py-0 sm:overflow-x-auto sm:overscroll-x-contain">
            <ul
              aria-label="World landmarks"
              className="flex gap-[var(--pw-spacing-xs)] max-sm:w-full max-sm:min-w-0 max-sm:overflow-x-auto max-sm:overscroll-x-contain sm:shrink-0"
            >
              {skeleton.map(navButton)}
            </ul>
            {personal.length > 0 && (
              <ul
                aria-label="Personal sections"
                className="flex flex-wrap gap-[var(--pw-spacing-xs)] sm:shrink-0 sm:flex-nowrap sm:border-l sm:border-[var(--pw-border-subtle)] sm:pl-[var(--pw-spacing-md)]"
              >
                {personal.map(navButton)}
              </ul>
            )}
          </div>
        </nav>

        <WorldButton
          variant="secondary"
          onPress={() => setRememberOpen(true)}
          className="shrink-0 max-sm:ml-auto"
        >
          <Icon name="bookmark" size={20} />
          <span className="ml-[var(--pw-spacing-xs)]">Remember</span>
        </WorldButton>

        {/* Readout cells */}
        <HealthReadout />
      </header>

      {confirmedNote && (
        <div
          role="status"
          className="relative z-10 mx-[var(--pw-spacing-xl)] mt-[var(--pw-spacing-md)] flex flex-wrap items-center gap-[var(--pw-spacing-md)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-md)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-primary)]"
        >
          <span className="flex-1">You’re confirmed for the next few minutes. You can make your change now.</span>
          <WorldButton variant="ghost" onPress={() => setConfirmedNoteDismissed(true)}>
            Dismiss
          </WorldButton>
        </div>
      )}

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

      <WorldDrawer isOpen={rememberOpen} onClose={() => setRememberOpen(false)} title="Remember">
        {rememberOpen ? (
          <RememberForm />
        ) : null}
      </WorldDrawer>

      {/* A sticker that just landed peels quietly into the corner. */}
      <StickerLanding roughNightOpen={activeArea === "rough-night"} onOpenAlbum={() => setActiveArea("stickers")} />

      {/* Status strip — bottom bar pattern from starfield */}
      <StatusStrip />
    </div>
    </AskInChatContext.Provider>
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
      ? "Connected."
      : word === "Checking"
        ? "Connecting…"
        : word === "Degraded"
          ? "Connected, but some parts aren’t answering."
          : "Can’t reach Worlds. Nothing here is current.";
  const dotColor =
    word === "Online"
      ? "bg-[var(--pw-accent-teal)]"
      : word === "Checking"
        ? "bg-[var(--pw-text-muted)]"
        : "bg-[var(--pw-accent-warm)]";

  return (
    <footer className="relative z-20 flex items-center gap-4 pt-[var(--pw-spacing-sm)] pb-[calc(var(--pw-spacing-sm)_+_var(--pw-safe-area-inset-bottom))] pl-[calc(var(--pw-spacing-lg)_+_var(--pw-safe-area-inset-left))] pr-[calc(var(--pw-spacing-lg)_+_var(--pw-safe-area-inset-right))] border-t border-[var(--pw-border-subtle)] bg-[var(--pw-surface-hull)]/90 backdrop-blur-md">
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
        <span>Worlds</span>
      </div>
    </footer>
  );
}
