import { useCallback, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_PREFS, PrefsCtx, type Prefs } from "./prefs-core";
const KEY = "worlds.prefs.v2";

function load(): Prefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const stored = JSON.parse(raw) as Partial<Prefs> & { theme?: string };
    // The Plain theme was removed (it matched Starfield); anything unknown falls back to the default.
    const theme = stored.theme === "daylight" ? "daylight" : "starfield";
    return { ...DEFAULT_PREFS, ...stored, theme };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function PrefsProvider({ children, initial }: { children: ReactNode; initial?: Partial<Prefs> }) {
  const [prefs, setPrefs] = useState<Prefs>(() => ({ ...load(), ...initial }));
  const set = useCallback((p: Partial<Prefs>) => {
    setPrefs((cur) => {
      const next = { ...cur, ...p };
      try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable: keep in memory */ }
      return next;
    });
  }, []);
  const value = useMemo(() => ({ prefs, set }), [prefs, set]);
  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
}
