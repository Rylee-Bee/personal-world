import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils";
import { useSections } from "../lib/hooks";
import { Icon, sectionIconToShimName } from "../lib/icons";
import type { SectionData } from "../lib/api";

/**
 * AnchorNav — the four primary navigation links.
 *
 * §14: Today, World, Journal, Chat — in canonical order.
 * If the API doesn't provide an anchor (e.g. "world" is frontend-
 * only), synthesize it. If the API provided it and it's hidden,
 * respect the hiding.
 */

const ANCHOR_ORDER = ["today", "world", "journal", "chat"] as const;
const ANCHOR_IDS: Set<string> = new Set(ANCHOR_ORDER);

const FALLBACKS: Record<string, { label: string; icon: string }> = {
  today: { label: "Today", icon: "navigation--today" },
  world: { label: "World", icon: "world-content--world" },
  journal: { label: "Journal", icon: "navigation--journal" },
  chat: { label: "Chat", icon: "navigation--chat" },
};

export interface AnchorNavProps {
  items?: SectionData[];
  compact?: boolean;
  className?: string;
}

export function AnchorNav({ items, compact = false, className }: AnchorNavProps) {
  const query = useSections();
  const allSections = items ?? query.data ?? [];
  const visible = allSections.filter((s) => s.visible);

  const anchorMap = new Map(visible.filter((s) => ANCHOR_IDS.has(s.id)).map((s) => [s.id, s]));
  const apiKnows = new Set(allSections.map((s) => s.id));

  const anchors: SectionData[] = [];
  for (const id of ANCHOR_ORDER) {
    const s = anchorMap.get(id);
    if (s) {
      anchors.push(s);
    } else if (!apiKnows.has(id)) {
      const fb = FALLBACKS[id as keyof typeof FALLBACKS];
      if (fb) {
        anchors.push({
          id, label: fb.label, icon: fb.icon, order: 0,
          visible: true, pinned: false, kind: "core",
          configured: true, status: null,
        });
      }
    }
  }

  return (
    <ul className={cn("pw-nav-anchors", className)} role="list">
      {anchors.map((s) => {
        const shim = sectionIconToShimName(s.icon);
        const to = s.id === "today" ? "/" : `/${s.id}`;
        return (
          <li key={s.id}>
            <NavLink
              to={to}
              end={s.id === "today"}
              aria-current="page"
              className={({ isActive }) =>
                cn("pw-nav-link", isActive && "pw-nav-link--active")
              }
            >
              {shim && (
                <Icon name={shim} size={compact ? 22 : 18} className="pw-nav-icon" aria-hidden />
              )}
              <span>{s.label}</span>
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}
