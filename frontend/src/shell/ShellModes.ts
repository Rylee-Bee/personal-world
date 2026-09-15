import type { ShellMode } from "./WorldShell";

/**
 * Route → shell mode mapping.
 *
 * Shell mode is a canonical screen/state property, NOT derived from
 * emotional volume. Each route declares its mode explicitly based on
 * the canonical Workshop v3 frame evidence.
 *
 * Routes without explicit evidence are marked UNKNOWN and default to
 * sidebar mode conservatively.
 */

const ROUTE_MODES: Record<string, ShellMode> = {
  // Today Quiet Day (17:481): Navigation rail, 112px
  "/": "rail",
  // Interests (17:1515): Project sidebar, 256px
  "/interests": "sidebar",
  // Bad Day (17:2117): Sidebar, 248px
  // (same route as "/", different state — mode is rail for quiet day)
  // Journal Writing (17:2268): Sidebar, 264px
  "/journal": "sidebar",
  // Projects (17:2752): Sidebar, 268px
  "/projects": "sidebar",
  // Vault (17:1014): Sidebar, 236px
  "/vault": "sidebar",
  // Settings (17:3762): Sidebar, 260px
  "/settings": "sidebar",
  // Your World (17:5485): Sidebar, 240px
  "/world": "sidebar",
  // Companion Chat (17:2536): Sidebar, 238px (dimmed workspace + drawer)
  "/chat": "sidebar",
  // Media: UNKNOWN — no canonical frame, default to sidebar
  "/media": "sidebar",
  // Lab: UNKNOWN — no canonical frame, default to sidebar
  "/lab": "sidebar",
};

/**
 * Route → sidebar width (px) from Figma canonical frames.
 *
 * Each sidebar-mode screen declares its Figma-specified width.
 * Rail-mode screens and routes without a canonical frame use the
 * default token value (248px).
 */
const ROUTE_SIDEBAR_WIDTHS: Record<string, number> = {
  // Today Bad Day (17:2117): Sidebar, 248px
  // (only applies when Today switches to sidebar mode for attention)
  "/interests": 256,  // 17:1515
  "/journal": 264,    // 17:2268
  "/projects": 268,   // 17:2752
  "/vault": 236,      // 17:1014
  "/settings": 260,   // 17:3762
  "/world": 240,      // 17:5485
  "/chat": 238,       // 17:2536
};

export function getShellMode(pathname: string): ShellMode {
  return ROUTE_MODES[pathname] ?? "sidebar";
}

/**
 * Returns the Figma-specified sidebar width for a route, in pixels.
 * Falls back to 248px (the token default) for routes without a
 * canonical frame or for rail-mode screens.
 */
export function getSidebarWidth(pathname: string): number {
  return ROUTE_SIDEBAR_WIDTHS[pathname] ?? 248;
}
