/**
 * Whether the person put the first-day guide away — kept on THIS device
 * (localStorage), like the theme: the station has no place for it yet.
 * Every read and write is wrapped: blocked storage means the guide just
 * shows (it never breaks the Bridge). Settings can bring it back.
 */
import { useSyncExternalStore } from "react";
import { useJournalList, useRooms } from "../../data/hooks";
import type { BridgeData } from "../../data/contract";
import type { WorldAreaId } from "../../data/types";

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

/** The guide was shown on this device (so finishing it can be marked).
 *  Never overrides "hidden". */
export function markFirstDayShown(): void {
  try {
    if (window.localStorage.getItem(KEY) === null) window.localStorage.setItem(KEY, "shown");
  } catch {
    /* storage blocked: the settled-in moment just won't appear */
  }
}

/** Whether this device has shown the guide before. A World that was
 *  already settled when the guide shipped never gets a surprise moment. */
export function wasFirstDayShown(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "shown";
  } catch {
    return false;
  }
}

/** What each briefing system is, in plain words (briefing.SYSTEM_SPECS). */
export const SYSTEM_ABOUT: Record<string, string> = {
  agents: "Your projects and the agents working on them, from Project Home.",
  estate: "The machines and services your World runs on, from Lab.",
  records: "Your journal and records.",
  interests: "Things you’re curious about, from the Candy room.",
  news: "News and stories you follow, from Media.",
  threads: "Where you left off, and the threads you’re following.",
};

/** Where each system is set up, in plain words (owner's first-day
 *  walk-through, 2026-09-27: "not set up yet" led nowhere). `area` is the
 *  page that sets it up; a system with no area can't be set up from Worlds
 *  yet, says so, and doesn't count against the first day. */
export const SETUP_FOR: Record<string, { area: WorldAreaId | null; label: string; how: string }> = {
  agents: { area: "projects", label: "Open Projects", how: "Projects fill in when Hive Works or Project Home is connected as a room." },
  estate: { area: "systems", label: "Open Computers", how: "Your machines come from the Engine room; Computers shows what it sees." },
  records: { area: "memory", label: "Open Memory", how: "Write your first note or add a record in Memory." },
  threads: { area: "memory", label: "Open Memory", how: "Where you left off comes from your journal in Memory." },
  news: { area: null, label: "", how: "Newsstand can’t be set up yet. News is moving to the Candy room, and this lights up when it’s connected." },
};

/** Not set up (dim on the map). */
export const NOT_SET_UP = new Set(["not_configured", "disabled"]);

/** A system that isn't set up and can't be yet: it never counts against you. */
export function waitingOnWorlds(s: { id: string; status: string }): boolean {
  return NOT_SET_UP.has(s.status) && SETUP_FOR[s.id]?.area === null;
}

/** Statuses that mean a system answered with something (briefing
 *  _FRESH_STATUSES): the rest are not set up, unknown or unreachable. */
export const ANSWERING = new Set(["healthy", "warning", "stale", "needs_attention"]);

/** Where the first day stands, from the same live data the guide shows.
 *  `showing` is true only while the guide is actually on the Bridge (so
 *  the companion's messages can stay quiet then: one voice at a time). */
export function useFirstDayProgress(data: BridgeData) {
  const hidden = useFirstDayHidden();
  const rooms = useRooms();
  const journal = useJournalList({ n: 200 });
  const speaker = data.keeper.resident;
  const crewOn = speaker.key !== null;
  const roomCount = rooms.data?.data?.length;
  // Systems nobody can set up yet don't count: the step can still finish.
  const countable = data.systems.filter((s) => !waitingOnWorlds(s));
  const answering = countable.filter((s) => ANSWERING.has(s.status)).length;
  const wroteNote = (journal.data?.data ?? []).some((e) => e.provenance?.source === "user");
  const companionChosen = crewOn && speaker.key !== "assistant";
  const roomsDone = (roomCount ?? 0) > 0;
  const systemsDone = countable.length > 0 && answering === countable.length;
  const lines = [roomsDone, systemsDone, wroteNote, ...(crewOn ? [companionChosen] : [])];
  const allDone = lines.every(Boolean);
  const settling = rooms.isPending || journal.isPending;
  const showing = !hidden && !allDone && !settling;
  return { hidden, settling, showing, allDone, speaker, crewOn, roomCount, answering, countable: countable.length, wroteNote, companionChosen, roomsDone, systemsDone };
}
