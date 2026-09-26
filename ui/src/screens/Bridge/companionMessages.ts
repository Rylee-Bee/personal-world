/**
 * Companion messages: the person's choice and what's been seen, kept on
 * THIS device (like the first-day guide). Every storage access is wrapped:
 * blocked storage means the default ("when something happens"), never a
 * broken Bridge. Owner rule (2026-09-25): at most one every 30 seconds,
 * dismissible, quiet days quiet.
 */
import { useSyncExternalStore } from "react";
import type { BridgeData } from "../../data/contract";
import { plural } from "../../components/rooms/format";

export type MessagesMode = "all" | "needs" | "off";
export const MESSAGES_MODES: { value: MessagesMode; label: string }[] = [
  { value: "all", label: "When something happens (at most one every 30 seconds)" },
  { value: "needs", label: "Only when something needs me" },
  { value: "off", label: "Off" },
];

/** The minimum gap between two messages. */
export const MESSAGE_GAP_MS = 30_000;

const MODE_KEY = "pw-companion-messages";
const DISMISSED_KEY = "pw-companion-message-dismissed";
const LAST_KEY = "pw-companion-message-last";
const listeners = new Set<() => void>();

function get(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked: nothing to remember */
  }
}

function readMode(): MessagesMode {
  const v = get(MODE_KEY);
  return v === "needs" || v === "off" ? v : "all";
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === MODE_KEY || e.key === DISMISSED_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useMessagesMode(): MessagesMode {
  return useSyncExternalStore(subscribe, readMode, () => "all");
}

export function setMessagesMode(mode: MessagesMode): void {
  set(MODE_KEY, mode);
  listeners.forEach((l) => l());
}

export function useDismissedMessage(): string | null {
  return useSyncExternalStore(subscribe, () => get(DISMISSED_KEY), () => null);
}

export function dismissMessage(key: string): void {
  set(DISMISSED_KEY, key);
  listeners.forEach((l) => l());
}

/** When the last message was shown (ms since epoch), 0 if never. */
export function lastShownAt(): number {
  const n = Number(get(LAST_KEY));
  return Number.isFinite(n) ? n : 0;
}

export function markShown(at: number): void {
  set(LAST_KEY, String(at));
}

export interface Message {
  key: string;
  text: string;
}

/** What's worth saying, or null on a quiet day. */
export function composeMessage(data: BridgeData, mode: "all" | "needs"): Message | null {
  const arrived = data.systems.reduce((n, s) => n + (s.counts?.arrivals ?? 0), 0);
  const needs = data.have_tos_total;
  const key = `${data.since ?? "first"}:${arrived}:${needs}`;
  if (needs > 0 && (mode === "needs" || arrived === 0)) {
    return { key, text: `${plural(needs, "thing needs", "things need")} you, whenever you're ready.` };
  }
  if (mode === "needs" || arrived === 0) return null;
  const newest = data.arrivals[0]?.title;
  const lead = `${plural(arrived, "new thing", "new things")} came in since you were here`;
  const tail = needs > 0 ? `, and ${plural(needs, "thing needs", "things need")} you.` : ". Nothing needs you.";
  return { key, text: `${lead}${tail}${newest ? ` Newest: “${newest}”.` : ""}` };
}

