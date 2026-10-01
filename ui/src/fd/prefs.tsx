import { useCallback, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_PREFS, PrefsCtx, type Prefs } from "./prefs-core";
const KEY = "worlds.prefs.v2";

function load(): Prefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
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
