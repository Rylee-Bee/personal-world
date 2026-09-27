/**
 * Stickers that just landed, waiting to peel into the corner, and the one
 * rule for when they stay quiet.
 *
 * - `landed(id)` queues a Worlds sticker the server said is new.
 * - The peel shows it unless `useStickerMuted()`: Rough night is open or was
 *   opened in the last 12 hours, or it's the person's quiet hours (their
 *   notification settings; 21:00–08:00 by default), or dim mode (when it
 *   exists, it plugs in here). Muted means no peel at all: the sticker simply
 *   waits in the album, marked new.
 * - "New" is remembered on this device until the album has shown it.
 */
import { useSyncExternalStore } from "react";
import { useNotificationPrefs } from "../../data/hooks";

let queue: string[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function landed(id: string): void {
  if (!queue.includes(id)) queue = [...queue, id];
  emit();
}
export function dismissLanded(id: string): void {
  queue = queue.filter((x) => x !== id);
  emit();
}
export function useLanded(): string[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => queue,
    () => queue,
  );
}

// ── "New" in the album (this device) ─────────────────────────────────
const SEEN = "pw-stickers-seen";
function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(SEEN) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
export function isSeen(key: string): boolean {
  return readSeen().has(key);
}
export function markSeen(keys: string[]): void {
  try {
    const s = readSeen();
    keys.forEach((k) => s.add(k));
    window.localStorage.setItem(SEEN, JSON.stringify([...s].slice(-500)));
  } catch {
    /* storage blocked: "new" just shows again next time */
  }
}

// ── Quiet ─────────────────────────────────────────────────────────────
const ROUGH = "pw-rough-night-at";
const TWELVE_HOURS = 12 * 60 * 60 * 1000;

/** Called when the Rough night page opens. */
export function noteRoughNight(now = Date.now()): void {
  try {
    window.localStorage.setItem(ROUGH, String(now));
  } catch {
    /* storage blocked: quiet hours still apply */
  }
}

function roughNightRecently(now: number): boolean {
  try {
    const at = Number(window.localStorage.getItem(ROUGH) ?? "0");
    return at > 0 && now - at < TWELVE_HOURS;
  } catch {
    return false;
  }
}

function minutes(hhmm: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Inside quiet hours (start–end may run past midnight). */
export function inQuietHours(q: { on?: boolean; start?: string; end?: string } | undefined, now = new Date()): boolean {
  const on = q?.on ?? true;
  if (!on) return false;
  const start = minutes(q?.start ?? "21:00");
  const end = minutes(q?.end ?? "08:00");
  if (start === null || end === null || start === end) return false;
  const t = now.getHours() * 60 + now.getMinutes();
  return start < end ? t >= start && t < end : t >= start || t < end;
}

/** The one rule for a quiet peel. `dim` joins when dim mode exists. */
export function useStickerMuted(opts: { roughNightOpen?: boolean; now?: Date } = {}): boolean {
  const prefs = useNotificationPrefs();
  const now = opts.now ?? new Date();
  const quiet = (prefs.data?.data as { quiet_hours?: { on?: boolean; start?: string; end?: string } } | undefined)?.quiet_hours;
  return Boolean(opts.roughNightOpen) || roughNightRecently(now.getTime()) || inQuietHours(quiet, now);
}
