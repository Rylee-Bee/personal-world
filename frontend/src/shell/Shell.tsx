import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnchorNav } from "./AnchorNav";
import { PlacesMenu } from "./PlacesMenu";
import { Drawer } from "../primitives/Drawer";
import { CompanionSlot } from "../primitives/CompanionSlot";
import { ChatPanel } from "../components/ChatPanel";
import { stashCorrectionDraft } from "../lib/correction-draft";
import type { ChatJournalCorrectionProposal } from "../lib/api";
import { useSections } from "../lib/hooks";
import { useCompanion, COMPANIONS } from "../lib/companion-context";

/**
 * Shell — the application frame.
 *
 * Desktop (≥900px): sidebar + content
 * Tablet (600–899px): header banner + content
 * Phone (≤599px): header + content + bottom bar
 *
 * The sidebar holds: brand, four anchors, Places, companion.
 * The header holds: brand, Places (phone), assistant trigger.
 * The bottom bar holds: four anchors only.
 */

type Viewport = "desktop" | "tablet" | "phone";

function useViewport(): Viewport {
  const [v, setV] = useState<Viewport>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "desktop";
    if (window.matchMedia("(min-width: 900px)").matches) return "desktop";
    if (window.matchMedia("(min-width: 600px)").matches) return "tablet";
    return "phone";
  });

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mqls = [
      window.matchMedia("(min-width: 900px)"),
      window.matchMedia("(min-width: 600px)"),
    ];
    const update = () => {
      if (mqls[0].matches) setV("desktop");
      else if (mqls[1].matches) setV("tablet");
      else setV("phone");
    };
    mqls.forEach((m) => m.addEventListener("change", update));
    return () => mqls.forEach((m) => m.removeEventListener("change", update));
  }, []);

  return v;
}

export interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  const vp = useViewport();
  const location = useLocation();
  const navigate = useNavigate();
  const sectionsQuery = useSections();
  const visibleSections = (sectionsQuery.data ?? []).filter((s) => s.visible);

  const { companion } = useCompanion();
  const companionMeta = COMPANIONS[companion];
  const companionIcon = companionMeta?.icon || "/companions/personal-world.svg";

  const [assistantOpen, setAssistantOpen] = useState(false);
  const openAssistant = () => setAssistantOpen(true);
  const closeAssistant = () => setAssistantOpen(false);

  const routeSectionId =
    location.pathname === "/"
      ? "today"
      : location.pathname.replace(/^\//, "").split("/")[0];
  const routeSection =
    (sectionsQuery.data ?? []).find((s) => s.id === routeSectionId) ?? null;
  const selectedEntity =
    routeSectionId === "projects"
      ? new URLSearchParams(location.search).get("repo")
      : null;
  const isGlobalChatRoute = routeSectionId === "chat";

  const sectionContext = isGlobalChatRoute
    ? undefined
    : {
        route: location.pathname,
        sectionId: routeSectionId,
        label: routeSection?.label ?? "your world",
        entity: selectedEntity,
      };

  const onPrepareCorrection = (proposal: ChatJournalCorrectionProposal) => {
    stashCorrectionDraft(proposal);
    closeAssistant();
    navigate(`/journal?correct=${encodeURIComponent(proposal.entry_ts)}`);
  };

  const sidebar = (
    <>
      {/* Brand */}
      <div className="pw-sidebar-brand">
        <div className="pw-sidebar-brand-icon" aria-hidden="true">
          <img src={companionIcon} alt="" />
        </div>
        <span className="pw-sidebar-brand-name">Project Worlds</span>
      </div>

      {/* Four anchors */}
      <nav aria-label="Main">
        <AnchorNav sections={visibleSections} compact={vp === "phone"} />
      </nav>

      {/* Places */}
      <PlacesMenu sections={visibleSections} />

      {/* Companion at bottom */}
      <div className="pw-sidebar-companion" aria-hidden="true">
        <div className="pw-sidebar-companion-art">
          <img src={companionIcon} alt="" />
        </div>
        <span className="pw-sidebar-companion-label">quietly here</span>
      </div>
    </>
  );

  return (
    <div className="pw-shell" data-pw-viewport={vp}>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Header: tablet + phone */}
      <header className="pw-header">
        <span className="pw-brand">Project Worlds</span>
        <span className="pw-header-end">
          {vp === "phone" && (
            <PlacesMenu sections={visibleSections} />
          )}
          <CompanionSlot
            size="nav"
            asAssistantTrigger
            onOpenAssistant={openAssistant}
          />
        </span>
      </header>

      {/* Sidebar: desktop only */}
      {vp === "desktop" && (
        <aside className="pw-sidebar" aria-label="Navigation">
          {sidebar}
        </aside>
      )}

      {/* Bottom bar: phone only — anchors only */}
      {vp === "phone" && (
        <nav aria-label="Main" className="pw-bottom-bar">
          <AnchorNav sections={visibleSections} compact />
        </nav>
      )}

      {/* Main content */}
      <main id="main-content" className="pw-main">
        {children}
      </main>

      {/* Assistant drawer */}
      <Drawer
        open={assistantOpen}
        title="World Assistant"
        onClose={closeAssistant}
        side={vp === "phone" ? "bottom" : "right"}
      >
        <ChatPanel
          sectionContext={sectionContext}
          onPrepareCorrection={onPrepareCorrection}
        />
      </Drawer>
    </div>
  );
}
