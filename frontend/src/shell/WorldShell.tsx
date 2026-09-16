import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SectionNav } from "./SectionNav";
import { PlacesMenu } from "./PlacesMenu";
import { Drawer } from "../primitives/Drawer";
import { CompanionSlot } from "../primitives/CompanionSlot";
import { ChatPanel } from "../components/ChatPanel";
import { stashCorrectionDraft } from "../lib/correction-draft";
import type { ChatJournalCorrectionProposal } from "../lib/api";
import { useSections } from "../lib/hooks";
import { getShellMode } from "./ShellModes";

/**
 * WorldShell — Workshop v3 mode-based shell.
 *
 * Shell mode is a canonical screen/state property, NOT derived from
 * emotional volume. Each screen declares its mode explicitly.
 *
 * §14 Navigation model:
 *   - Four anchors (Today, World, Journal, Chat) as primary nav
 *   - Places mechanism for secondary destinations
 *
 * Modes:
 *   rail     — 112px, brand mark, nav anchors + Places, world assistant
 *   sidebar  — 236–272px, optional identity/divider/companion, nav
 *
 * Responsive cascade:
 *   ≥900px        edge (rail or sidebar) + content
 *   600–899px     banner header + content (anchors + Places button)
 *   <600px        content + bottom bar (4 anchors) + Places in header
 */

export type ShellMode = "rail" | "sidebar";
export type ShellViewport = "rail" | "banner" | "bottom";

const RAIL_QUERY = "(min-width: 900px)";
const BANNER_QUERY = "(min-width: 600px) and (max-width: 899px)";
const BOTTOM_QUERY = "(max-width: 599px)";

export function viewportBucket(): ShellViewport {
  if (typeof window.matchMedia !== "function") return "rail";
  if (window.matchMedia(RAIL_QUERY).matches) return "rail";
  if (window.matchMedia(BANNER_QUERY).matches) return "banner";
  return "bottom";
}

function useViewportBucket(): ShellViewport {
  const [bucket, setBucket] = useState<ShellViewport>(() => viewportBucket());
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const onChange = () => setBucket(viewportBucket());
    const mqls = [RAIL_QUERY, BANNER_QUERY, BOTTOM_QUERY].map((q) =>
      window.matchMedia(q)
    );
    mqls.forEach((mql) => mql.addEventListener("change", onChange));
    onChange();
    return () => mqls.forEach((mql) => mql.removeEventListener("change", onChange));
  }, []);
  return bucket;
}

export interface WorldShellProps {
  /**
   * Canonical shell mode for this screen/state.
   * If omitted, derived from the current route via ShellModes mapping.
   */
  mode?: ShellMode;
  /**
   * World edge content. The shell renders this inside the edge region.
   * The shell does NOT mandate what appears here — identity, divider,
   * nav, and companion are per-screen canonical properties.
   */
  edge: ReactNode;
  /** Route content; rendered inside `<main id="main-content">`. */
  children: ReactNode;
}

export function WorldShell({ mode: modeProp, edge, children }: WorldShellProps) {
  const location = useLocation();
  const mode = modeProp ?? getShellMode(location.pathname);
  const bucket = useViewportBucket();
  const navigate = useNavigate();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const openAssistant = () => setAssistantOpen(true);
  const handleCloseAssistant = () => setAssistantOpen(false);

  const onPrepareCorrection = (proposal: ChatJournalCorrectionProposal) => {
    stashCorrectionDraft(proposal);
    handleCloseAssistant();
    navigate(`/journal?correct=${encodeURIComponent(proposal.entry_ts)}`);
  };

  const sectionsQuery = useSections();
  const visibleSections = (sectionsQuery.data ?? []).filter((s) => s.visible);
  const routeSectionId =
    location.pathname === "/" ? "today" : location.pathname.replace(/^\//, "").split("/")[0];
  const selectedEntity =
    routeSectionId === "projects"
      ? new URLSearchParams(location.search).get("repo")
      : null;
  const isGlobalChatRoute = routeSectionId === "chat";
  const routeSection =
    (sectionsQuery.data ?? []).find((s) => s.id === routeSectionId) ?? null;
  const sectionContext = isGlobalChatRoute
    ? undefined
    : {
        route: location.pathname,
        sectionId: routeSectionId,
        label: routeSection?.label ?? "your world",
        entity: selectedEntity,
      };

  return (
    <div
      className={`pw-shell pw-shell--${mode}`}
      data-pw-mode={mode}
      data-pw-viewport={bucket}
    >
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Header: visible on tablet/mobile only. Desktop uses edge.
          §14: phone uses top Places in header. Tablet uses banner nav. */}
      <header className="pw-header">
        <span className="pw-brand-lockup">
          <span
            className="pw-brand"
            style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
          >
            Project Worlds
          </span>
        </span>
        {bucket === "banner" ? (
          <nav aria-label="Main" className="pw-banner-nav">
            <SectionNav />
          </nav>
        ) : null}
        <span className="pw-header-end">
          {/* Phone: Places in header */}
          {bucket === "bottom" && (
            <PlacesMenu sections={visibleSections} />
          )}
          <CompanionSlot
            size="nav"
            asAssistantTrigger
            onOpenAssistant={openAssistant}
          />
        </span>
      </header>

      {/* World edge: the screen's canonical edge content.
          Mode determines structural dimensions, not composition.
          The assistant trigger lives here for desktop (≥900px) since
          .pw-header is hidden at that breakpoint. */}
      {bucket === "rail" ? (
        <nav
          aria-label="Main"
          className="pw-edge"
          data-pw-mode={mode}
        >
          {edge}
          <div className="pw-edge-assistant-trigger">
            <CompanionSlot
              size="nav"
              asAssistantTrigger
              onOpenAssistant={openAssistant}
            />
          </div>
        </nav>
      ) : null}

      {/* Bottom bar: mobile only — four anchors only.
          §14: "Use four labeled bottom anchors." */}
      {bucket === "bottom" ? (
        <nav aria-label="Main" className="pw-bottom-bar">
          <SectionNav compact hidePlaces />
        </nav>
      ) : null}

      <main id="main-content" className="pw-main">
        {children}
      </main>

      <Drawer
        open={assistantOpen}
        title="World Assistant"
        onClose={handleCloseAssistant}
        side={bucket === "bottom" ? "bottom" : "right"}
      >
        <ChatPanel sectionContext={sectionContext} onPrepareCorrection={onPrepareCorrection} />
      </Drawer>
    </div>
  );
}
