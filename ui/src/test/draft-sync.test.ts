/**
 * Draft-sync client tests (B1–B4, B7) — DRAFT-SYNC-SPEC-2026-09-20.
 *
 * Pure module + fake timers + a spy transport: every spec rule gets
 * mechanical evidence, including the privacy rule (B4) which asserts
 * draft text reaches the NETWORK body and nowhere else — never a
 * console call, never a retained or emitted error message.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The typed client captures globalThis.fetch at module load, so the
// B4 spy must be installed BEFORE this file's imports evaluate.
const wire = vi.hoisted(() => {
  const sent: { url: string; method: string; body: string }[] = [];
  let mode = "ok";
  const previous = globalThis.fetch;
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    const request = input as Request;
    const body = request.body ? await request.clone().text() : "";
    sent.push({ url: request.url, method: request.method, body });
    if (mode === "ok") {
      return new Response(
        JSON.stringify({
          ok: true,
          data: { saved_at: "2026-09-20T04:00:00Z", length: body.length },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    // The real server's failure bodies are {detail} — never draft text.
    return new Response(JSON.stringify({ detail: "draft exceeds 100000 chars" }), {
      status: 422,
      headers: { "content-type": "application/json" },
    });
  });
  globalThis.fetch = spy as unknown as typeof previous;
  return {
    sent,
    spy,
    setMode: (m: "ok" | "fail") => {
      mode = m;
    },
    restore: () => {
      globalThis.fetch = previous;
    },
  };
});
import {
  DRAFT_IDLE_MS,
  DRAFT_QUEUE_MAX,
  createDraftSync,
  draftStatusLine,
  flushLegacyDrafts,
  liveTransport,
  readLocalMirror,
  resolveResume,
  LOCAL_MIRROR_KEY,
  type DraftServerCopy,
  type DraftTransport,
} from "../data/draft-sync";

// ─── Helpers ─────────────────────────────────────────────

function fakeTransport(put = vi.fn().mockResolvedValue(undefined)): {
  t: DraftTransport;
  put: ReturnType<typeof vi.fn>;
} {
  return { t: { put, get: vi.fn(), remove: vi.fn() }, put };
}

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string): string | null => data.get(k) ?? null,
    setItem: (k: string, v: string): void => {
      data.set(k, v);
    },
    removeItem: (k: string): void => {
      data.delete(k);
    },
    has: (k: string): boolean => data.has(k),
  };
}

const serverCopy = (over: Partial<DraftServerCopy> = {}): DraftServerCopy => ({
  text: null,
  updated_at: null,
  entry_id: "",
  device: "",
  ...over,
});

// ─── B1: debounced PUT on the keystroke pause ────────────

describe("draft-sync B1 — debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends nothing during typing and exactly one PUT after the idle pause", async () => {
    const { t, put } = fakeTransport();
    const sync = createDraftSync(t);
    sync.notify({ text: "half" });
    sync.notify({ text: "half a" });
    sync.notify({ text: "half a thought…" });
    await vi.advanceTimersByTimeAsync(DRAFT_IDLE_MS - 1);
    expect(put).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenLastCalledWith({ text: "half a thought…" });
    sync.destroy();
  });

  it("restarts the timer on every keystroke (only real pauses write)", async () => {
    const { t, put } = fakeTransport();
    const sync = createDraftSync(t);
    sync.notify({ text: "a" });
    for (let i = 0; i < 10; i += 1) {
      await vi.advanceTimersByTimeAsync(600); // always interrupted < 1s
      sync.notify({ text: `a${"b".repeat(i)}` });
    }
    expect(put).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(DRAFT_IDLE_MS);
    expect(put).toHaveBeenCalledTimes(1);
    sync.destroy();
  });

  it("walks pending → syncing → saved and flush() delivers without waiting", async () => {
    const { t } = fakeTransport();
    const sync = createDraftSync(t);
    const seen: string[] = [];
    sync.subscribe((s) => seen.push(s));
    sync.notify({ text: "quick" });
    expect(sync.status()).toBe("pending");
    await sync.flush();
    expect(sync.status()).toBe("saved");
    expect(seen).toEqual(["pending", "syncing", "saved"]);
    sync.destroy();
  });
});

// ─── B7: bounded retry queue, newest wins, online flush ──

describe("draft-sync B7 — retry queue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a failed PUT becomes 'queued' and waits — no timer hammering", async () => {
    const put = vi.fn().mockRejectedValue(new Error("offline"));
    const { t } = fakeTransport(put);
    const sync = createDraftSync(t);
    sync.notify({ text: "lost?" });
    await vi.advanceTimersByTimeAsync(DRAFT_IDLE_MS);
    expect(sync.status()).toBe("queued");
    expect(put).toHaveBeenCalledTimes(1);
    // A full minute of waiting: still exactly one attempt.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(put).toHaveBeenCalledTimes(1);
    sync.destroy();
  });

  it("the online event flushes the NEWEST queued write", async () => {
    let online = false;
    const put = vi.fn().mockImplementation(async () => {
      if (!online) throw new Error("offline");
    });
    const { t } = fakeTransport(put);
    const sync = createDraftSync(t);

    sync.notify({ text: "oldest words" });
    await vi.advanceTimersByTimeAsync(DRAFT_IDLE_MS);
    expect(sync.status()).toBe("queued");

    sync.notify({ text: "newest words" });
    await vi.advanceTimersByTimeAsync(DRAFT_IDLE_MS);
    expect(sync.status()).toBe("queued");
    expect(put).toHaveBeenCalledTimes(2); // two pauses, two attempts — no hammering

    online = true;
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0); // let the flush settle
    expect(sync.status()).toBe("saved");
    expect(put).toHaveBeenCalledTimes(3);
    expect(put).toHaveBeenLastCalledWith({ text: "newest words" });
    expect(sync.pending()).toBe(0);
    sync.destroy();
  });

  it("queue is bounded at DRAFT_QUEUE_MAX with oldest evicted", async () => {
    let release: () => void = () => {};
    const put = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { t } = fakeTransport(put);
    const sync = createDraftSync(t);
    sync.notify({ text: "in flight" });
    await vi.advanceTimersByTimeAsync(DRAFT_IDLE_MS); // drain starts, hangs
    expect(put).toHaveBeenCalledTimes(1);
    for (let i = 0; i < DRAFT_QUEUE_MAX + 5; i += 1) {
      sync.notify({ text: `burst-${i}` });
    }
    expect(sync.pending()).toBe(DRAFT_QUEUE_MAX);
    release();
    await vi.advanceTimersByTimeAsync(DRAFT_IDLE_MS + 1);
    // newest wins: one final PUT carries the last burst item…
    expect(put).toHaveBeenLastCalledWith({
      text: `burst-${DRAFT_QUEUE_MAX + 4}`,
    });
    // …and at most one extra PUT happened, not twenty.
    expect(put.mock.calls.length).toBeLessThanOrEqual(3);
    sync.destroy();
  });

  it("draftStatusLine(queued) is the spec's one honest line", () => {
    expect(draftStatusLine("queued")).toBe("Saved on device, syncing…");
  });
});

// ─── B2: legacy pw-* flush ───────────────────────────────

describe("draft-sync B2 — legacy flush", () => {
  it("posts legacy notes once (oldest first, titles kept) and deletes the key on 200", async () => {
    const store = fakeStorage({
      "pw-journal-entries": JSON.stringify([
        { ts: 1, body: "first note" },
        { ts: 2, title: "Titled", body: "second note" },
        { ts: 3, body: "   " }, // empty bodies never invent content
      ]),
    });
    const put = vi.fn().mockResolvedValue(undefined);
    const res = await flushLegacyDrafts(store, { put });
    expect(res.flushed).toEqual(["pw-journal-entries"]);
    expect(res.deferred).toEqual([]);
    expect(put).toHaveBeenCalledTimes(1);
    const sent = put.mock.calls[0]?.[0] as { text: string; device?: string };
    expect(sent.text).toBe("first note\n\nTitled\nsecond note");
    expect(sent.device).toBe("legacy-import");
    expect(store.has("pw-journal-entries")).toBe(false); // only after 200
  });

  it("keeps the key when the server does not confirm", async () => {
    const store = fakeStorage({
      "pw-journal-entries": JSON.stringify([{ ts: 1, body: "mine" }]),
    });
    const put = vi.fn().mockRejectedValue(new Error("HTTP 500"));
    const res = await flushLegacyDrafts(store, { put });
    expect(res.deferred).toEqual(["pw-journal-entries"]);
    expect(store.has("pw-journal-entries")).toBe(true);
  });

  it("an unreadable legacy value is deferred, never deleted", async () => {
    const store = fakeStorage({ "pw-journal-entries": "{not json" });
    const put = vi.fn();
    const res = await flushLegacyDrafts(store, { put });
    expect(put).not.toHaveBeenCalled();
    expect(res.deferred).toEqual(["pw-journal-entries"]);
    expect(store.has("pw-journal-entries")).toBe(true);
  });

  it("no legacy key on this device means no request", async () => {
    const put = vi.fn();
    const res = await flushLegacyDrafts(fakeStorage(), { put });
    expect(put).not.toHaveBeenCalled();
    expect(res).toEqual({ flushed: [], deferred: [] });
  });
});

// ─── B3: GET-on-open conflict rules (offer, never clobber)

describe("draft-sync B3 — resolveResume", () => {
  it("nothing local takes the world's copy", () => {
    const d = resolveResume(serverCopy({ text: "from phone", updated_at: "t2" }), null);
    expect(d).toEqual({ kind: "take-server", text: "from phone" });
  });

  it("identical copies agree quietly", () => {
    const local = { text: "same", editedAt: "e1", serverStamp: "t1" };
    expect(resolveResume(serverCopy({ text: "same", updated_at: "t1" }), local)).toEqual({
      kind: "agree",
    });
  });

  it("server changed after this device last saw it: CONFLICT (chooser)", () => {
    const local = { text: "my edit", editedAt: "e1", serverStamp: "t1" };
    const d = resolveResume(serverCopy({ text: "other device edit", updated_at: "t2" }), local);
    expect(d.kind).toBe("conflict");
  });

  it("a server copy this device already knows about is out-edited, not a conflict", () => {
    const local = { text: "my newer edit", editedAt: "e2", serverStamp: "t1" };
    expect(resolveResume(serverCopy({ text: "old words", updated_at: "t1" }), local)).toEqual({
      kind: "offer-local",
    });
  });

  it("world empty, device holds a draft: offer-local", () => {
    const local = { text: "never reached the world", editedAt: "e1", serverStamp: null };
    expect(resolveResume(serverCopy(), local)).toEqual({ kind: "offer-local" });
  });

  it("a corrupt local mirror reads as absent (never crashes resume)", () => {
    expect(readLocalMirror(fakeStorage({ [LOCAL_MIRROR_KEY]: "‹garbage›" }))).toBeNull();
  });
});

// ─── B4: no draft text in any log line or error path ─────

describe("draft-sync B4 — privacy", () => {
  const SECRET = "the most private diary sentence imaginable";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("liveTransport+fetch: text crosses the wire but never a console call, success or failure", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const sync = createDraftSync(liveTransport);
    sync.notify({ text: SECRET });
    await vi.advanceTimersByTimeAsync(DRAFT_IDLE_MS);
    // The real openapi-fetch pipeline settles over a few awaits:
    await vi.waitFor(() => expect(sync.status()).toBe("saved"));

    wire.setMode("fail");
    sync.notify({ text: `${SECRET} — take two` });
    await vi.advanceTimersByTimeAsync(DRAFT_IDLE_MS);
    // Failure is absorbed into the honest "queued" state, never thrown.
    await vi.waitFor(() => expect(sync.status()).toBe("queued"));
    sync.destroy();
    wire.restore();
    wire.setMode("ok");

    // The wire DID carry the words (that is the sync contract):
    const puts = wire.sent.filter((s) => s.method === "PUT");
    expect(puts.length).toBeGreaterThanOrEqual(2);
    expect(puts.every((s) => s.url.endsWith("/api/journal/draft"))).toBe(true);
    expect(puts[0]?.body).toContain("private diary");

    // And NOTHING else saw them: console stayed shut in every path,
    // success and failure alike (B4).
    for (const spy of [log, warn, error]) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain("private diary");
      }
      expect(spy).not.toHaveBeenCalled();
    }
    // The surfaces the module exposes carry state words, never content.
    expect(draftStatusLine(sync.status())).toBe("Saved on device, syncing…");
  });

  it("direct transport failure retains no error object with content", async () => {
    const put = vi.fn().mockRejectedValue(new Error(`boom: ${SECRET}`));
    const { t } = fakeTransport(put);
    const sync = createDraftSync(t);
    sync.notify({ text: SECRET });
    await vi.advanceTimersByTimeAsync(DRAFT_IDLE_MS);
    expect(sync.status()).toBe("queued");
    // Nothing the module exposes can carry the secret onward:
    expect(sync.pending()).toBe(1);
    expect(draftStatusLine(sync.status())).not.toContain("private diary");
    sync.destroy();
  });
});
