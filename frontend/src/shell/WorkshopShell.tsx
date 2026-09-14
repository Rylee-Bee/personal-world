import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { WorldShell } from "./WorldShell";
import { DefaultEdge } from "./DefaultEdge";
import { WorldIdentity } from "./WorldIdentity";
import { CompanionPresence } from "./CompanionPresence";
import { SectionNav } from "./SectionNav";
import { getShellMode } from "./ShellModes";

/**
 * WorkshopShell — the production shell wrapper.
 *
 * Reads the current route, determines the canonical shell mode,
 * and provides the default edge content.
 *
 * Rail mode: brand mark + nav + world assistant
 * Sidebar mode: identity + nav + companion
 */

export interface WorkshopShellProps {
  children: ReactNode;
}

export function WorkshopShell({ children }: WorkshopShellProps) {
  const location = useLocation();
  const mode = getShellMode(location.pathname);

  const edge = (
    <DefaultEdge
      mode={mode}
      identity={mode === "sidebar" ? <WorldIdentity /> : undefined}
      nav={<SectionNav compact />}
      companion={mode === "sidebar" ? <CompanionPresence /> : undefined}
    />
  );

  return (
    <WorldShell mode={mode} edge={edge}>
      {children}
    </WorldShell>
  );
}
