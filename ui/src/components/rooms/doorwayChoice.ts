/**
 * Which library doorway a person chose for each room — kept on THIS
 * device (localStorage), the same honesty rule as the theme: the station
 * has no endpoint for it yet, and the picker says "on this device".
 * Presentation only; never sent to a room.
 *
 * Every read and write is wrapped: private windows, blocked storage and
 * previews fall back to "nothing chosen" (the room's own art or the
 * plain arch), never an error.
 */
import { useSyncExternalStore } from "react";
import { isDoorwayId } from "./crew";

const KEY = "pw-room-doorways";
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Record<string, string> } = { raw: null, value: {} };

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function snapshot(): Record<string, string> {
  const raw = readRaw();
  if (raw === cache.raw) return cache.value;
  let value: Record<string, string> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") {
      value = Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(
          (e): e is [string, string] => isDoorwayId(e[1]),
        ),
      );
    }
  } catch {
    value = {};
  }
  cache = { raw, value };
  return value;
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

/** Room id → chosen library doorway id, for this device. */
export function useDoorwayChoices(): Record<string, string> {
  return useSyncExternalStore(subscribe, snapshot, () => ({}));
}

/** Choose a doorway for a room, or null to go back to the room's own art. */
export function setDoorwayChoice(roomId: string, doorwayId: string | null): boolean {
  const next = { ...snapshot() };
  if (doorwayId && isDoorwayId(doorwayId)) next[roomId] = doorwayId;
  else delete next[roomId];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  listeners.forEach((l) => l());
  return true;
}
