import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils";
import { useSections } from "../lib/hooks";
import { Icon, sectionIconToShimName } from "../lib/icons";
import type { SectionData } from "../lib/api";
import { PlacesMenu, ANCHOR_IDS } from "./PlacesMenu";

/**
 * SectionNav — Workshop v3 navigation.
 *
 * §14 Navigation model: four anchors plus compact Places.
 *
 * Anchors: Today, World, Journal, Chat — always visible as primary
 * navigation. These are the four labeled bottom anchors on phone, the
 * top nav on tablet, and the edge nav on desktop.
 *
 * Places: a compact mechanism containing all secondary destinations
 * (Interests, Projects, Media, Vault, Lab, Notifications,
 * Connections, Settings).
 *
 * The nav is driven by GET /api/sections — never a hard-coded list.
 * Anchor ids that the API doesn't provide are gracefully omitted.
 * Hidden sections are omitted from nav (routes still resolve).
 * Active item carries aria-current="page".
 * All targets ≥ 44px (--pw-target-minimum).
 */

const ANCHOR_ORDER = ["today", "world", "journal", "chat"] as const;

function AnchorLink({
  section,
  compact,
}: {
  section: SectionData;
  compact: boolean;
}) {
  const shimName = sectionIconToShimName(section.icon);
  const to = section.id === "today" ? "/" : `/${section.id}`;
  return (
    <NavLink
      to={to}
      end={section.id === "today"}
      aria-current="page"
      className={({ isActive }) =>
        cn(
          "pw-nav-link",
          compact ? "pw-nav-link--rail" : "pw-nav-link--full",
          isActive && "pw-nav-link--active"
        )
      }
    >
      {shimName ? (
        <Icon
          name={shimName}
          size={compact ? 24 : 18}
          className="pw-nav-icon"
          aria-hidden={true}
        />
      ) : null}
      <span className="pw-nav-label">{section.label}</span>
    </NavLink>
  );
}

export interface SectionNavProps {
  items?: SectionData[];
  /** Rail form: icon over label, tighter width (≥900px rail). */
  compact?: boolean;
  /** Hide the Places mechanism (used in mobile bottom bar where
   *  Places is rendered separately in the header). */
  hidePlaces?: boolean;
  className?: string;
}

export function SectionNav({
  items,
  compact = false,
  hidePlaces = false,
  className,
}: SectionNavProps) {
  const query = useSections();
  const sections = (items ?? query.data ?? []).filter((s) => s.visible);

  // Separate anchors from places destinations.
  // §14: Four anchors in canonical order. If the API doesn't provide
  // an anchor (e.g. "world" is a frontend-only route), synthesize a
  // minimal entry so the anchor always appears in navigation.
  // BUT: if the API provided the section and it's hidden (not in
  // `sections` because it was filtered by visible), do NOT synthesize
  // a fallback — the person deliberately hid it.

  // The raw data before visible filtering tells us which sections
  // the API knows about (including hidden ones).
  const rawData = items ?? query.data ?? [];
  const apiKnowsAbout = new Set(rawData.map((s) => s.id));

  const anchorSections: SectionData[] = [];
  const anchorMap = new Map<string, SectionData>();
  for (const s of sections) {
    if (ANCHOR_IDS.has(s.id)) {
      anchorMap.set(s.id, s);
    }
  }
  // Enforce canonical order for anchors; synthesize missing ones
  // only if the API never provided them (not just hidden).
  const FALLBACK_ANCHORS: Record<string, { label: string; icon: string }> = {
    today: { label: "Today", icon: "navigation--today" },
    world: { label: "World", icon: "world-content--world" },
    journal: { label: "Journal", icon: "navigation--journal" },
    chat: { label: "Chat", icon: "navigation--chat" },
  };
  for (const id of ANCHOR_ORDER) {
    const s = anchorMap.get(id);
    if (s) {
      anchorSections.push(s);
    } else if (!apiKnowsAbout.has(id)) {
      // The API doesn't know about this anchor at all — synthesize it.
      const fallback = FALLBACK_ANCHORS[id];
      if (fallback) {
        anchorSections.push({
          id,
          label: fallback.label,
          icon: fallback.icon,
          order: 0,
          visible: true,
          pinned: false,
          kind: "core",
          configured: true,
          status: null,
        });
      }
    }
    // else: the API knows about this anchor but it's hidden — skip it.
  }

  const hasPlaces = sections.some((s) => !ANCHOR_IDS.has(s.id));

  return (
    <div className={cn("pw-nav", className)}>
      <ul className={cn("pw-nav-list", compact && "pw-nav-list--compact")} role="list">
        {anchorSections.map((section) => (
          <li key={section.id}>
            <AnchorLink section={section} compact={compact} />
          </li>
        ))}
      </ul>
      {hasPlaces && !hidePlaces && (
        <PlacesMenu sections={sections} compact={compact} />
      )}
    </div>
  );
}
