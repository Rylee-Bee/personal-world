import { createContext, useContext } from "react";
import type { Density, Pack, Theme, Words } from "./types";

export interface Prefs { words: Words; density: Density; pack: Pack; theme: Theme; name?: string }
export const DEFAULT_PREFS: Prefs = { words: "short", density: "standard", pack: "none", theme: "starfield" };
export const PrefsCtx = createContext<{ prefs: Prefs; set: (p: Partial<Prefs>) => void }>({ prefs: DEFAULT_PREFS, set: () => undefined });
export const usePrefs = () => useContext(PrefsCtx);
