import type { ReactNode } from "react";
import type { ShellMode } from "./WorldShell";

/**
 * Default edge content for each shell mode.
 *
 * These are the MINIMUM structural elements observed in the canonical
 * frames. Screens can override any of these — identity, divider, nav,
 * and companion are per-screen canonical properties, not mandatory.
 *
 * Rail mode: brand mark + nav + world assistant
 * Sidebar mode: nav only (identity, divider, companion are per-screen)
 */

export interface DefaultEdgeProps {
  mode: ShellMode;
  /** Optional identity slot — rendered at top of edge if provided. */
  identity?: ReactNode;
  /** Optional divider slot — rendered between identity and nav if provided. */
  divider?: ReactNode;
  /** Navigation content — always rendered. */
  nav: ReactNode;
  /** Optional companion slot — rendered at bottom of edge if provided. */
  companion?: ReactNode;
}

export function DefaultEdge({ identity, divider, nav, companion }: DefaultEdgeProps) {
  return (
    <>
      {identity}
      {divider}
      {nav}
      {companion && (
        <div style={{ marginTop: "auto" }}>
          {companion}
        </div>
      )}
    </>
  );
}
