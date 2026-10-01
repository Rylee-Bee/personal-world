import { useCallback } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { Board, BoardItem, CardEnvelope, ErrorClass, NeedsYouEntry } from "./types";

/** A failed request, classed by what actually happened. Never carries a made-up request id. */
export class ApiError extends Error {
  errorClass: ErrorClass;
  status?: number;
  constructor(errorClass: ErrorClass, status?: number) {
    super(`${errorClass}${status ? ` ${status}` : ""}`);
    this.errorClass = errorClass;
    this.status = status;
  }
}

export const DEFAULT_TIMEOUT_MS = 10_000;

async function getJson<T>(url: string, timeoutMs: number): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetch(url, { headers: { accept: "application/json" }, signal: ctl.signal });
    } catch {
      throw new ApiError(ctl.signal.aborted ? "timeout" : "connection");
    }
    if (!res.ok) throw new ApiError(res.status >= 500 ? "http_5xx" : "http_4xx", res.status);
    try {
      return (await res.json()) as T;
    } catch {
      throw new ApiError(ctl.signal.aborted ? "timeout" : "malformed", res.status);
    }
  } finally {
    clearTimeout(timer);
  }
}

export type Status = "loading" | "ok" | "error";
export interface CardFailure { errorClass: ErrorClass; status?: number }
interface CardsResult {
  cards: Record<string, CardEnvelope>;
  failures: Record<string, CardFailure>;
  pending: string[];
}

export interface HomeData {
  board: Board | undefined;
  boardStatus: Status;
  refetchBoard: () => void;
  needsYou: NeedsYouEntry[];
  needsYouStatus: Status;
  refetchNeedsYou: () => void;
  /** Cards that loaded. After a failed refetch the old data stays, marked stale with the previous fetch time. */
  cards: Record<string, CardEnvelope>;
  /** Cards that never loaded, with the real failure class. */
  failures: Record<string, CardFailure>;
  /** Card ids still loading. Home renders without them. */
  pending: string[];
}

const NO_ITEMS: BoardItem[] = [];
const NO_ENTRIES: NeedsYouEntry[] = [];

/**
 * The board, the needs-you list and each card load independently: none waits on another, and one
 * failing never hides the rest.
 */
export function useHomeData(timeoutMs: number = DEFAULT_TIMEOUT_MS): HomeData {
  const boardQ = useQuery({ queryKey: ["fd", "board", "home"], queryFn: () => getJson<Board>("/api/boards/home", timeoutMs), retry: 1, retryDelay: 150 });
  const nyQ = useQuery({ queryKey: ["fd", "needs-you"], queryFn: () => getJson<NeedsYouEntry[]>("/api/needs-you", timeoutMs), retry: 1, retryDelay: 150 });
  const items = boardQ.data?.items ?? NO_ITEMS;

  const combine = useCallback(
    (results: { data?: CardEnvelope; isError: boolean; isPending: boolean; error: unknown; dataUpdatedAt: number }[]): CardsResult => {
      const out: CardsResult = { cards: {}, failures: {}, pending: [] };
      results.forEach((q, n) => {
        const id = items[n].card;
        if (q.data) {
          out.cards[id] = q.isError
            ? { ...q.data, freshness: "stale", last_good_at: new Date(q.dataUpdatedAt).toISOString() }
            : q.data;
        } else if (q.isError) {
          const e = q.error instanceof ApiError ? q.error : new ApiError("connection");
          out.failures[id] = { errorClass: e.errorClass, status: e.status };
        } else out.pending.push(id);
      });
      return out;
    },
    [items],
  );
  const cardsQ = useQueries({
    queries: items.map((i) => ({ queryKey: ["fd", "card", i.card], queryFn: () => getJson<CardEnvelope>(`/api/cards/${i.card}`, timeoutMs), retry: 1, retryDelay: 150 })),
    combine,
  });

  return {
    board: boardQ.data,
    boardStatus: boardQ.isError ? "error" : boardQ.data ? "ok" : "loading",
    refetchBoard: () => void boardQ.refetch(),
    needsYou: nyQ.data ?? NO_ENTRIES,
    needsYouStatus: nyQ.isError && !nyQ.data ? "error" : nyQ.data ? "ok" : "loading",
    refetchNeedsYou: () => void nyQ.refetch(),
    ...cardsQ,
  };
}
