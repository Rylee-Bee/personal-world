import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BOARD_KEY } from "./api";
import { applyEdits, fromItems, NO_EDITS, toItems, type ConfigItem, type Edits } from "./edit-model";
import type { Board } from "./types";

interface ConfigDoc { schema_version: number; id: string; title: string; home: boolean; items: ConfigItem[] }
export interface SaveError { kind: "conflict" | "invalid" | "other"; text: string }

class Fail extends Error {
  kind: SaveError["kind"];
  constructor(kind: SaveError["kind"], text: string) {
    super(text);
    this.kind = kind;
  }
}

/** The CSRF token for cookie-authenticated writes (empty when there is no cookie, e.g. the dev principal). */
function csrfHeaders(): Record<string, string> {
  const m = typeof document !== "undefined" ? document.cookie.match(/(?:^|;\s*)pw_csrf=([^;]+)/) : null;
  return m ? { "X-CSRF-Token": decodeURIComponent(m[1]) } : {};
}

async function detailOf(res: Response): Promise<string> {
  try {
    const d = (await res.json()) as { detail?: unknown };
    return typeof d.detail === "string" ? d.detail : "";
  } catch {
    return "";
  }
}

/**
 * Edit Home as C1 board writes: the arrangement is saved with PUT /api/config/board/{id} and If-Match, one
 * write per action, in order. Undo is another write. A 409 or 422 reverts the display and says so; nothing
 * is kept only in the browser.
 */
export function useBoardEdit(board: Board | undefined) {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Edits>(NO_EDITS);
  const [past, setPast] = useState<{ items: ConfigItem[]; message: string }[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<SaveError | null>(null);
  const cfg = useRef<{ doc: ConfigDoc; etag: string } | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const dead = useRef(false);
  const pending = useRef(0);
  const arranged = useMemo(() => (board ? applyEdits(board, edits) : undefined), [board, edits]);

  const write = async (id: string, items: ConfigItem[]) => {
    if (!cfg.current) {
      const res = await fetch(`/api/config/board/${id}`, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Fail("other", "Couldn't load Home's settings.");
      cfg.current = { doc: (await res.json()) as ConfigDoc, etag: res.headers.get("etag") ?? "" };
    }
    const { doc, etag } = cfg.current;
    let res: Response;
    try {
      res = await fetch(`/api/config/board/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json", "if-match": etag, ...csrfHeaders() },
        body: JSON.stringify({ ...doc, items }),
      });
    } catch {
      throw new Fail("other", "Couldn't reach Worlds. Your edit wasn't saved.");
    }
    if (res.status === 409) throw new Fail("conflict", "Home changed somewhere else, your edit wasn't saved.");
    if (res.status === 422) throw new Fail("invalid", `Couldn't save: ${(await detailOf(res)) || "Home's settings were refused."}`);
    if (!res.ok) throw new Fail("other", "Couldn't save your edit.");
    cfg.current = { doc: (await res.json()) as ConfigDoc, etag: res.headers.get("etag") ?? etag };
  };

  const enqueue = (id: string, items: ConfigItem[]) => {
    pending.current += 1;
    chain.current = chain.current.then(async () => {
      try {
        if (dead.current) return;
        await write(id, items);
        await qc.invalidateQueries({ queryKey: BOARD_KEY });
      } catch (e) {
        dead.current = true;
        setError(e instanceof Fail ? { kind: e.kind, text: e.message } : { kind: "other", text: "Couldn't save your edit." });
        setNote("");
      } finally {
        pending.current -= 1;
        // Drop the overlay once everything queued is confirmed (or abandoned): the board now shows the truth.
        if (pending.current === 0) setEdits(NO_EDITS);
      }
    });
  };

  const apply = (next: Edits, message: string) => {
    if (!board || !arranged || dead.current) return;
    setPast((p) => [...p, { items: toItems(arranged), message }]);
    setEdits(next);
    setNote(message);
    enqueue(board.id, toItems(applyEdits(board, next)));
  };

  const undo = () => {
    const last = past[past.length - 1];
    if (!last || !board || dead.current) return;
    setPast((p) => p.slice(0, -1));
    setEdits(fromItems(last.items));
    setNote(`Undid: ${last.message.toLowerCase()}`);
    enqueue(board.id, last.items);
  };

  /** After a failed save: forget the optimistic state and the history, and read the board again. */
  const reload = () => {
    dead.current = false;
    cfg.current = null;
    setEdits(NO_EDITS);
    setPast([]);
    setError(null);
    setNote("");
    void qc.invalidateQueries({ queryKey: BOARD_KEY });
  };

  return { edits, arranged, note, error, canUndo: past.length > 0, apply, undo, reload };
}
