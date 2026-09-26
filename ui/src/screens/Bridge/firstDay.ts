/**
 * Whether the person put the first-day guide away — kept on THIS device
 * (localStorage), like the theme: the station has no place for it yet.
 * Every read and write is wrapped: blocked storage means the guide just
 * shows (it never breaks the Bridge). Settings can bring it back.
 */
import { useSyncExternalStore } from "react";

const KEY = "pw-first-day-guide";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "hidden";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useFirstDayHidden(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

export function setFirstDayHidden(hidden: boolean): void {
  try {
    if (hidden) window.localStorage.setItem(KEY, "hidden");
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: nothing to remember */
  }
  listeners.forEach((l) => l());
}

/** What each briefing system is, in plain words (briefing.SYSTEM_SPECS). */
export const SYSTEM_ABOUT: Record<string, string> = {
  agents: "Your projects and the agents working on them, from Project Home.",
  estate: "The machines and services your World runs on, from Lab.",
  records: "Your journal and records.",
  interests: "Things you’ve said you’re curious about, from Discovery.",
  news: "News and stories you follow, from Media.",
  threads: "Where you left off, and the threads you’re following.",
};

/** Statuses that mean a system answered with something (briefing
 *  _FRESH_STATUSES): the rest are not set up, unknown or unreachable. */
export const ANSWERING = new Set(["healthy", "warning", "stale", "needs_attention"]);
