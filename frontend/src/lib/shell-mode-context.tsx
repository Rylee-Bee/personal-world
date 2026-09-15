import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { ShellMode } from "../shell/WorldShell";

/**
 * Screen-level shell mode override.
 *
 * Some screens (Today) change shell mode based on data state:
 *   - Quiet day → rail mode (17:481)
 *   - Bad day / attention → sidebar mode (17:2117)
 *   - Question / curiosity → sidebar mode (17:6245)
 *
 * Screens call setScreenMode(mode) to signal their preferred shell mode.
 * WorkshopShell reads screenMode and uses it instead of the route default
 * when set.
 */

interface ShellModeOverride {
  screenMode: ShellMode | null;
  setScreenMode: (mode: ShellMode | null) => void;
}

const ShellModeOverrideContext = createContext<ShellModeOverride>({
  screenMode: null,
  setScreenMode: () => {},
});

export function ShellModeOverrideProvider({ children }: { children: ReactNode }) {
  const [screenMode, setScreenState] = useState<ShellMode | null>(null);
  const setScreenMode = useCallback((mode: ShellMode | null) => setScreenState(mode), []);
  return (
    <ShellModeOverrideContext.Provider value={{ screenMode, setScreenMode }}>
      {children}
    </ShellModeOverrideContext.Provider>
  );
}

export function useShellModeOverride() {
  return useContext(ShellModeOverrideContext);
}
