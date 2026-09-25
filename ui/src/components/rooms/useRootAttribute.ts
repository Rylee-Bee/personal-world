import { useSyncExternalStore } from "react";

/**
 * Read an attribute Worlds applies to <html> (data-theme from the
 * device's theme choice, data-pw-* from server-truth prefs via
 * prefs-dom.ts) and follow it when it changes. Absent means unknown,
 * returned as null — callers treat unknown as "no decoration", never as
 * a guess.
 */
export function useRootAttribute(name: string): string | null {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof MutationObserver === "undefined") return () => {};
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: [name],
      });
      return () => observer.disconnect();
    },
    () => document.documentElement.getAttribute(name),
    () => null,
  );
}

/** The current time, refreshed once a minute — enough to say "last
 *  checked …" honestly without re-rendering every second. */
export function useMinuteClock(): number {
  return useSyncExternalStore(
    (onChange) => {
      const timer = window.setInterval(onChange, 60_000);
      return () => window.clearInterval(timer);
    },
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => 0,
  );
}
