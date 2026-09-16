import { useRef, useState, useCallback, useEffect, type JSX } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Icon, sectionIconToShimName } from "../lib/icons";
import type { SectionData } from "../lib/api";
import { cn } from "../lib/utils";

/**
 * PlacesMenu — the compact secondary-navigation mechanism.
 *
 * Four anchors (Today, World, Journal, Chat) are always visible as
 * primary nav. Everything else lives here: a labeled button that
 * opens a popover panel of secondary destinations.
 *
 * Design: §14 Navigation model — "Use a compact, labeled Places
 * mechanism" with light grouping, not nested enterprise menus.
 *
 * Groups:
 *   Personal pursuits: Interests, Projects, Media
 *   Deliberate/private: Vault, Lab
 *   Notices: Notifications (if present)
 *   Preferences: Connections, Settings
 */

/** Ids that belong in Places (everything that is NOT an anchor). */
export const ANCHOR_IDS = new Set(["today", "world", "journal", "chat"]);

/** Ordered groups within Places. Any section id not listed here
 *  falls through to an unlabeled tail group. */
const PLACES_GROUPS: { label: string; ids: string[] }[] = [
  { label: "Personal", ids: ["interests", "projects", "media"] },
  { label: "Tools", ids: ["vault", "lab"] },
  { label: "", ids: ["notifications"] },
  { label: "Preferences", ids: ["connections", "settings"] },
];



function isPlacesActive(sections: SectionData[]): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  return sections.some(
    (s) => !ANCHOR_IDS.has(s.id) && path === `/${s.id}`
  );
}

export interface PlacesMenuProps {
  /** All sections from the API (including anchors). */
  sections: SectionData[];
  /** Compact mode (icon-only trigger for bottom bar). */
  compact?: boolean;
  className?: string;
}

export function PlacesMenu({ sections, compact = false, className }: PlacesMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // §10: Synthesize missing grouped sections (e.g. "connections"
  // not yet in backend registry). Only for sections in PLACES_GROUPS
  // that the API doesn't provide at all (not just hidden).
  const rawData = sections; // This is already filtered by visible in SectionNav
  const apiKnows = new Set(rawData.map((s) => s.id));
  const SYNTHESIZED: Record<string, { label: string; icon: string }> = {
    connections: { label: "Connections", icon: "world-content--link" },
    notifications: { label: "Notifications", icon: "status-feedback--notification" },
  };

  let placesSections = sections.filter((s) => !ANCHOR_IDS.has(s.id));
  for (const [id, def] of Object.entries(SYNTHESIZED)) {
    if (!apiKnows.has(id) && !placesSections.some((s) => s.id === id)) {
      placesSections = [
        ...placesSections,
        {
          id,
          label: def.label,
          icon: def.icon,
          order: 99,
          visible: true,
          pinned: false,
          kind: "extension" as const,
          configured: false,
          status: null,
        },
      ];
    }
  }

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const isActive = isPlacesActive(placesSections);

  // Resolve sections by id for grouped rendering
  const sectionMap = new Map(placesSections.map((s) => [s.id, s]));

  return (
    <div className={cn("pw-places", className)}>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "pw-places-trigger",
          compact && "pw-places-trigger--compact",
          isActive && "pw-places-trigger--active"
        )}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Places"
      >
        <Icon
          name="icon-view-layout-grid"
          size={compact ? 22 : 18}
          className="pw-places-trigger-icon"
          aria-hidden={true}
        />
        <span className="pw-places-trigger-label">Places</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="pw-places-panel"
          role="menu"
          aria-label="Places"
        >
          {(() => {
            const rendered: JSX.Element[] = [];
            const consumed = new Set<string>();

            for (const group of PLACES_GROUPS) {
              const items = group.ids
                .map((id) => sectionMap.get(id))
                .filter((s): s is SectionData => !!s && s.visible);
              if (items.length === 0) continue;
              items.forEach((s) => consumed.add(s.id));
              rendered.push(
                <div key={group.label || group.ids[0]} className="pw-places-group" role="group" aria-label={group.label || undefined}>
                  {group.label && (
                    <p className="pw-places-group-label">{group.label}</p>
                  )}
                  {items.map((section) => {
                    const shimName = sectionIconToShimName(section.icon);
                    return (
                      <NavLink
                        key={section.id}
                        to={`/${section.id}`}
                        role="menuitem"
                        className={({ isActive: linkActive }) =>
                          cn("pw-places-item", linkActive && "pw-places-item--active")
                        }
                      >
                        {shimName && (
                          <Icon
                            name={shimName}
                            size={18}
                            className="pw-places-item-icon"
                            aria-hidden={true}
                          />
                        )}
                        <span className="pw-places-item-label">{section.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              );
            }

            // Uncategorized sections (not in any predefined group).
            const uncategorized = placesSections.filter(
              (s) => !consumed.has(s.id)
            );
            if (uncategorized.length > 0) {
              rendered.push(
                <div key="uncategorized" className="pw-places-group" role="group">
                  {uncategorized.map((section) => {
                    const shimName = sectionIconToShimName(section.icon);
                    return (
                      <NavLink
                        key={section.id}
                        to={`/${section.id}`}
                        role="menuitem"
                        className={({ isActive: linkActive }) =>
                          cn("pw-places-item", linkActive && "pw-places-item--active")
                        }
                      >
                        {shimName && (
                          <Icon
                            name={shimName}
                            size={18}
                            className="pw-places-item-icon"
                            aria-hidden={true}
                          />
                        )}
                        <span className="pw-places-item-label">{section.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              );
            }

            return rendered;
          })()}
        </div>
      )}
    </div>
  );
}
