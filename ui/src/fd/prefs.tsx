import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Density, Pack, Theme, Words } from "./types";

export interface Prefs { words: Words; density: Density; pack: Pack; theme: Theme }
export const DEFAULT_PREFS: Prefs = { words: "short", density: "standard", pack: "none", theme: "starfield" };
const KEY = "worlds.prefs.v2";

function load(): Prefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

const Ctx = createContext<{ prefs: Prefs; set: (p: Partial<Prefs>) => void }>({ prefs: DEFAULT_PREFS, set: () => undefined });

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
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const usePrefs = () => useContext(Ctx);
