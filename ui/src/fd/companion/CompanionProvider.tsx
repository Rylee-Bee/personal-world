import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { companionApi, newClientMsgId } from "./api";
import { DEFAULT_PRESENTATION, parsePresentation, type Presentation } from "./presentation";
import type { CompanionFailure, GrantView, StoredTurn, TurnResponse } from "./types";

/** One exchange as the panel shows it. `unknown` lines and the tier come straight from the reply, never invented. */
export interface ShownTurn {
  key: string;
  user: string;
  reply: string | null;
  unknown: string[];
  tier: "ordinary" | "stepped" | null;
}

interface Ctx {
  open: boolean;
  setOpen: (open: boolean) => void;
  presentation: Presentation;
  thinking: boolean;
  turns: ShownTurn[];
  failure: CompanionFailure | null;
  /** The text that did not get through, kept so Try again re-sends exactly it (same idempotency key). */
  pending: string | null;
  grant: GrantView | null;
  send: (message: string) => Promise<void>;
  retry: () => Promise<void>;
  newConversation: () => void;
  setGrant: (g: GrantView | null) => void;
}

const CompanionCtx = createContext<Ctx | null>(null);

export function useCompanion(): Ctx {
  const c = useContext(CompanionCtx);
  if (!c) throw new Error("useCompanion needs a CompanionProvider");
  return c;
}

export function turnsFromStored(stored: StoredTurn[]): ShownTurn[] {
  return stored.map((t, i) => ({ key: t.client_msg_id ?? `stored-${i}`, user: t.user_text, reply: t.assistant_text, unknown: [], tier: t.visibility_tier }));
}

export function CompanionProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [presentation, setPresentation] = useState<Presentation>({ ...DEFAULT_PRESENTATION });
  const [thinking, setThinking] = useState(false);
  const [turns, setTurns] = useState<ShownTurn[]>([]);
  const [failure, setFailure] = useState<CompanionFailure | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [grant, setGrant] = useState<GrantView | null>(null);
  const threadId = useRef<string | null>(null);
  const msgId = useRef<string | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(async (message: string, id: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setThinking(true);
    setFailure(null);
    const res = await companionApi.turn(message, id, threadId.current);
    inFlight.current = false;
    setThinking(false);
    if (!res.ok) {
      setFailure(res.failure);
      setPending(message);
      // Unknown is an answer: the person's words stay as they were, and nothing is made up.
      setPresentation({ ...DEFAULT_PRESENTATION, state: "attentive", tone: "concerned" });
      return;
    }
    const r: TurnResponse = res.data;
    threadId.current = r.thread_id ?? threadId.current;
    msgId.current = null;
    setPending(null);
    setTurns((t) => [...t.filter((x) => x.key !== id), { key: id, user: message, reply: r.reply, unknown: r.unknown, tier: r.tier_sent }]);
    setPresentation(parsePresentation(r.presentation));
    if (r.grant) setGrant((g) => ({ ...(g ?? {}), state: r.grant!.state, expires_at: r.grant!.expires_at }));
  }, []);

  const send = useCallback(async (message: string) => {
    const text = message.trim();
    if (!text) return;
    msgId.current = newClientMsgId();
    setTurns((t) => [...t, { key: msgId.current!, user: text, reply: null, unknown: [], tier: null }]);
    await run(text, msgId.current);
  }, [run]);

  const retry = useCallback(async () => {
    if (pending && msgId.current) await run(pending, msgId.current);
  }, [pending, run]);

  const newConversation = useCallback(() => {
    threadId.current = null;
    msgId.current = null;
    setTurns([]);
    setPending(null);
    setFailure(null);
    setPresentation({ ...DEFAULT_PRESENTATION });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ open, setOpen, presentation: thinking ? { ...presentation, state: "thinking" } : presentation, thinking, turns, failure, pending, grant, send, retry, newConversation, setGrant }),
    [open, presentation, thinking, turns, failure, pending, grant, send, retry, newConversation],
  );
  return <CompanionCtx.Provider value={value}>{children}</CompanionCtx.Provider>;
}
