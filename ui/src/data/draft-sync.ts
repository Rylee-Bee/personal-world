/**
 * Journal draft-sync — the client half of DRAFT-SYNC-SPEC-2026-09-20
 * ("Kept safe, synced", Rylee D15).
 *
 * What this module owns (no React inside, so every rule is unit-testable):
 *   B1  debounced PUT on the keystroke pause (~1 s idle, spec cadence)
 *   B2  one-time legacy flush of browser-local `pw-*` journal drafts
 *   B7  bounded retry queue on PUT failure (newest wins, cap 20, flush
 *       on reconnect via the window "online" event)
 *
 * Privacy (spec §contract + B4): draft text NEVER appears in console
 * output or in any error object this module retains or emits. The
 * server's write response reports {saved_at, length} and never echoes
 * text; this module upholds its half of that rule.
 *
 * Conflict policy (B3) lives here too: resume offers, never clobbers —
 * see resolveResume().
 */

import { deleteJournalDraft, getJournalDraft, putJournalDraft } from "./api";
import type { JournalDraftData } from "./contract";

/** The spec's "~1 s idle" write cadence. */
export const DRAFT_IDLE_MS = 1000;

/** B7: at most this many undelivered writes are held; oldest evict. */
export const DRAFT_QUEUE_MAX = 20;

export interface DraftSnapshot {
  entry_id?: string;
  text: string;
  device?: string;
}

/** The world's copy, straight from GET /api/journal/draft. */
export type DraftServerCopy = JournalDraftData;

/** Injected so tests (and Storybook) drive the transport directly. */
export interface DraftTransport {
  /** Resolves only on a 200 envelope; rejects WITHOUT draft content.
   * Resolves with the server's saved_at stamp (never text). */
  put(snapshot: DraftSnapshot): Promise<{ saved_at: string } | undefined>;
  get(): Promise<DraftServerCopy | null>;
  remove(): Promise<void>;
}

export const liveTransport: DraftTransport = {
  async put(snapshot) {
    // putJournalDraft throws ApiError whose message comes from the
    // server's {detail} — the draft routes never echo text, so an
    // ApiError here cannot carry draft content by construction.
    const res = await putJournalDraft(snapshot);
    return res.data ? { saved_at: res.data.saved_at } : undefined;
  },
  async get() {
    const res = await getJournalDraft();
    return res.data ?? null;
  },
  async remove() {
    await deleteJournalDraft();
  },
};

export type DraftStatus =
  | "idle" // nothing waiting
  | "pending" // edits held for the idle timer
  | "syncing" // a PUT is in flight
  | "saved" // the world has the newest text
  | "queued"; // offline/failed — waiting for reconnect or next edit

export interface DraftSync {
  /** Panel calls this on every keystroke-level change. */
  notify(snapshot: DraftSnapshot): void;
  /** Deliver whatever is newest right now (panel close / pagehide). */
  flush(): Promise<void>;
  /** Undelivered writes currently held (B7 queue depth). */
  pending(): number;
  status(): DraftStatus;
  /** Newest saved_at the server has confirmed to this instance. */
  lastSavedAt(): string | null;
  subscribe(listener: (status: DraftStatus) => void): () => void;
  /** Detach timers and the "online" listener. */
  destroy(): void;
}

/**
 * The one honest state line the spec asks for:
 * queued reads as "saved on device, syncing…" at the surface.
 */
export function draftStatusLine(status: DraftStatus): string {
  switch (status) {
    case "idle":
      return "";
    case "pending":
      return "Draft kept on this device…";
    case "syncing":
      return "Saving draft…";
    case "saved":
      return "Draft saved — safe to switch devices.";
    case "queued":
      return "Saved on device, syncing…";
  }
}

export function createDraftSync(
  transport: DraftTransport = liveTransport,
): DraftSync {
  const queue: DraftSnapshot[] = [];
  let current: DraftStatus = "idle";
  let lastSaved: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let draining = false;
  const listeners = new Set<(status: DraftStatus) => void>();

  const setStatus = (next: DraftStatus): void => {
    if (current === next) return;
    current = next;
    for (const listener of listeners) listener(next);
  };

  const armTimer = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void drain();
    }, DRAFT_IDLE_MS);
  };

  /**
   * B7 delivery rules: newest wins — the undelivered OLDER writes are
   * pointless for a single per-principal draft slot, so a drain sends
   * the last queued snapshot and drops the rest. On failure the newest
   * goes back on the queue ("queued", not lost) and nothing retries
   * until the next edit, the next timer, or the "online" event.
   */
  const drain = async (): Promise<void> => {
    if (draining || queue.length === 0) return;
    draining = true;
    const newest = queue[queue.length - 1];
    queue.length = 0;
    setStatus("syncing");
    try {
      const ack = await transport.put(newest);
      if (ack?.saved_at) lastSaved = ack.saved_at;
      setStatus("saved");
    } catch {
      // The failure carries no draft text (B4); we retain no error
      // object at all — only the snapshot and the honest state.
      // Retrying happens on the NEXT edit or the "online" event,
      // never on a timer loop: an offline device must not hammer.
      queue.push(newest);
      setStatus("queued");
    } finally {
      draining = false;
    }
  };

  const notify = (snapshot: DraftSnapshot): void => {
    queue.push(snapshot);
    if (queue.length > DRAFT_QUEUE_MAX) queue.shift(); // cap 20, oldest out
    setStatus("pending");
    armTimer();
  };

  const onOnline = (): void => {
    if (queue.length > 0) void drain();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", onOnline);
  }

  return {
    notify,
    flush: async () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      await drain();
    },
    pending: () => queue.length,
    status: () => current,
    lastSavedAt: () => lastSaved,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      queue.length = 0;
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onOnline);
      }
      listeners.clear();
    },
  };
}

// ─── B2: legacy `pw-*` draft flush ───────────────────────
//
// Evidence (verified 2026-09-20 against the frozen Station, read-only):
// design/opendesign-exploration/station/journal.html:323 keeps browser-
// local journal notes under localStorage key `pw-journal-entries` as a
// JSON array of {ts, title?, body, vault?}. That is the only journal-
// draft legacy key in real use; the other pw-* keys (map structure,
// positions, region, companion/mood) belong to B6's audit, not here.
//
// The flush posts each legacy body ONCE to /api/journal/draft (the
// notes join into the single per-principal draft, oldest first, so
// nothing is lost), then deletes the key ONLY after the server said
// 200. A failed flush leaves the key untouched — the next load retries.

export const LEGACY_JOURNAL_KEYS = ["pw-journal-entries"] as const;

interface LegacyJournalEntry {
  ts?: number | string;
  title?: string;
  body?: string;
  vault?: boolean;
}

function legacyText(raw: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null; // unreadable shape: leave it in place, never delete
  }
  if (!Array.isArray(parsed)) return null;
  const blocks: string[] = [];
  for (const item of parsed as LegacyJournalEntry[]) {
    if (typeof item?.body !== "string" || item.body.trim() === "") continue;
    const title =
      typeof item.title === "string" && item.title.trim() !== ""
        ? `${item.title.trim()}\n`
        : "";
    blocks.push(`${title}${item.body}`);
  }
  return blocks.length > 0 ? blocks.join("\n\n") : null;
}

export interface LegacyFlushResult {
  /** Keys migrated AND deleted from local storage. */
  flushed: string[];
  /** Keys still held because the server did not confirm (retry next load). */
  deferred: string[];
}

export async function flushLegacyDrafts(
  storage: Pick<Storage, "getItem" | "removeItem">,
  transport: Pick<DraftTransport, "put">,
  device = "legacy-import",
): Promise<LegacyFlushResult> {
  const flushed: string[] = [];
  const deferred: string[] = [];
  for (const key of LEGACY_JOURNAL_KEYS) {
    const raw = storage.getItem(key);
    if (raw === null) continue; // nothing on this device: nothing to do
    const text = legacyText(raw);
    if (text === null) {
      deferred.push(key);
      continue;
    }
    try {
      await transport.put({ text, device });
      storage.removeItem(key); // ONLY after the 200
      flushed.push(key);
    } catch {
      deferred.push(key); // honest: still this device's responsibility
    }
  }
  return { flushed, deferred };
}

// ─── B3: GET-on-open, offer-not-overwrite ────────────────

export interface LocalMirror {
  text: string;
  /** When THIS device last touched the draft (client clock). */
  editedAt: string;
  /** The newest server stamp this device has seen (0 = never synced). */
  serverStamp: string | null;
}

export const LOCAL_MIRROR_KEY = "pw-journal-draft-local";

export function readLocalMirror(
  storage: Pick<Storage, "getItem">,
): LocalMirror | null {
  const raw = storage.getItem(LOCAL_MIRROR_KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalMirror>;
    if (typeof parsed?.text !== "string" || typeof parsed?.editedAt !== "string") {
      return null;
    }
    return {
      text: parsed.text,
      editedAt: parsed.editedAt,
      serverStamp: typeof parsed.serverStamp === "string" ? parsed.serverStamp : null,
    };
  } catch {
    return null;
  }
}

export function writeLocalMirror(
  storage: Pick<Storage, "setItem">,
  mirror: LocalMirror,
): void {
  storage.setItem(LOCAL_MIRROR_KEY, JSON.stringify(mirror));
}

export function clearLocalMirror(
  storage: Pick<Storage, "removeItem">,
): void {
  storage.removeItem(LOCAL_MIRROR_KEY);
}

export type ResumeDecision =
  /** Nothing local; take the world's copy into the panel (or start blank). */
  | { kind: "take-server"; text: string | null }
  /** Local edits exist and the world has none of this: sync ours up. */
  | { kind: "offer-local" }
  /** Both sides hold the same words: resume quietly. */
  | { kind: "agree" }
  /** The world changed AFTER this device last saw it (and differs):
   * the panel must ASK — two options, no silent clobber either way. */
  | { kind: "conflict"; server: DraftServerCopy; local: LocalMirror };

export function resolveResume(
  server: DraftServerCopy,
  local: LocalMirror | null,
): ResumeDecision {
  const serverText = server.text;
  if (local === null || local.text.trim() === "") {
    return { kind: "take-server", text: serverText };
  }
  if (serverText === null || serverText.trim() === "") {
    return { kind: "offer-local" };
  }
  if (serverText === local.text) {
    return { kind: "agree" };
  }
  const serverStamp = server.updated_at;
  const newerOnServer =
    serverStamp !== null &&
    (local.serverStamp === null || serverStamp > local.serverStamp);
  if (newerOnServer) {
    return { kind: "conflict", server, local };
  }
  // We knew about this server copy already and out-edited it locally:
  // ours is simply the newest chapter, not a conflict.
  return { kind: "offer-local" };
}
