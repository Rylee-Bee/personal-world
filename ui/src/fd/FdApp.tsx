import { useCallback, useEffect, useState } from "react";
import { Connect } from "./Connect";
import { Home } from "./Home";
import { Memory } from "./Memory";
import { usePrefs } from "./prefs";
import { hashFor, parseHash, type Landmark } from "./route";
import { Settings } from "./Settings";
import { Shell } from "./Shell";
import { StationDecor } from "./StationDecor";

/** Personal boards are not served yet (C6 has only the home board). */
const BOARDS: { id: string; title: string }[] = [];

const SCREENS: Record<Landmark, () => React.JSX.Element> = {
  home: () => <Home />,
  connect: () => <Connect />,
  memory: () => <Memory />,
  settings: () => <Settings />,
};

export function FdApp() {
  const { prefs } = usePrefs();
  const [current, setCurrent] = useState<Landmark>(() => parseHash(window.location.hash));

  useEffect(() => {
    const sync = () => {
      // The skip link points at #main; keep the current screen.
      if (window.location.hash === "#main") return;
      setCurrent(parseHash(window.location.hash));
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // Preferences live on <html> so CSS (theme, density, pack) needs no re-render.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = prefs.theme;
    root.dataset.density = prefs.density;
    root.dataset.pack = prefs.pack;
  }, [prefs.theme, prefs.density, prefs.pack]);

  const navigate = useCallback((l: Landmark) => {
    window.location.hash = hashFor(l);
    setCurrent(l);
    document.getElementById("main")?.focus();
  }, []);

  const Screen = SCREENS[current];
  return (
    <Shell current={current} onNavigate={navigate} boards={BOARDS}>
      <StationDecor />
      <Screen />
    </Shell>
  );
}
