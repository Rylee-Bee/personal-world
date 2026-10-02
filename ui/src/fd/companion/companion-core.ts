import { createContext, useContext } from "react";
import type { Presentation } from "./presentation";
import type { CompanionFailure, GrantView } from "./types";

/** One exchange as the panel shows it. `unknown` lines and the tier come straight from the reply, never invented. */
export interface ShownTurn {
  key: string;
  user: string;
  reply: string | null;
  unknown: string[];
  tier: "ordinary" | "stepped" | null;
}

export interface Ctx {
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

export const CompanionCtx = createContext<Ctx | null>(null);

export function useCompanion(): Ctx {
  const c = useContext(CompanionCtx);
  if (!c) throw new Error("useCompanion needs a CompanionProvider");
  return c;
}

