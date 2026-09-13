import { createContext, useContext, useState, type ReactNode } from "react";
import type { ShellMode } from "./WorldShell";

/**
 * Shell configuration — set by screens to declare their canonical
 * shell mode and edge content.
 *
 * Shell mode is a canonical screen/state property, NOT derived from
 * emotional volume. Each route declares its mode explicitly.
 */

export interface ShellConfig {
  mode: ShellMode;
}

const ShellConfigContext = createContext<ShellConfig>({ mode: "sidebar" });

export function useShellConfig(): ShellConfig {
  return useContext(ShellConfigContext);
}

export interface ShellConfigProviderProps {
  config: ShellConfig;
  children: ReactNode;
}

export function ShellConfigProvider({ config, children }: ShellConfigProviderProps) {
  return (
    <ShellConfigContext.Provider value={config}>
      {children}
    </ShellConfigContext.Provider>
  );
}

/**
 * Edge content context — screens render their edge content here,
 * and the WorldShell picks it up.
 *
 * This allows screens to declare their own edge composition
 * (identity, divider, nav, companion) without the shell mandating any.
 */

export interface ShellEdgeContextValue {
  edge: ReactNode;
  setEdge: (edge: ReactNode) => void;
}

const ShellEdgeContext = createContext<ShellEdgeContextValue>({
  edge: null,
  setEdge: () => {},
});

export function useShellEdge() {
  return useContext(ShellEdgeContext);
}

export function ShellEdgeProvider({ children }: { children: ReactNode }) {
  const [edge, setEdge] = useState<ReactNode>(null);
  return (
    <ShellEdgeContext.Provider value={{ edge, setEdge }}>
      {children}
    </ShellEdgeContext.Provider>
  );
}
