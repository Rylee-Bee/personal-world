import { useCallback } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type {
  ActionSummary,
  Board,
  BoardItem,
  CardConfig,
  CardEnvelope,
  ConfigKind,
  ConfigList,
  ErrorClass,
  NeedsYouEntry,
  PreviewResult,
  Provider,
  Receipt,
  Request as ConnRequest,
  TryResult,
} from "./types";

/** A failed request, classed by what actually happened. Never carries a made-up request id. */
export class ApiError extends Error {
  errorClass: ErrorClass;
  status?: number;
  detail?: string;
  constructor(errorClass: ErrorClass, status?: number, detail?: string) {
    super(`${errorClass}${status ? ` ${status}` : ""}`);
    this.errorClass = errorClass;
    this.status = status;
    this.detail = detail;
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
  refetchBoard: () => Promise<unknown>;
  needsYou: NeedsYouEntry[];
  needsYouStatus: Status;
  refetchNeedsYou: () => Promise<unknown>;
  /** Cards that loaded. After a failed refetch the old data stays, marked stale with the previous fetch time. */
  cards: Record<string, CardEnvelope>;
  /** Cards that never loaded, with the real failure class. */
  failures: Record<string, CardFailure>;
  /** Card ids still loading. Home renders without them. */
  pending: string[];
}

export const BOARD_KEY = ["fd", "board", "home"] as const;

const NO_ITEMS: BoardItem[] = [];
const NO_ENTRIES: NeedsYouEntry[] = [];

/**
 * The board, the needs-you list and each card load independently: none waits on another, and one
 * failing never hides the rest.
 */
export function useHomeData(timeoutMs: number = DEFAULT_TIMEOUT_MS): HomeData {
  const boardQ = useQuery({ queryKey: BOARD_KEY, queryFn: () => getJson<Board>("/api/boards/home", timeoutMs), retry: 1, retryDelay: 150 });
  const nyQ = useQuery({ queryKey: ["fd", "needs-you"], queryFn: () => getJson<NeedsYouEntry[]>("/api/needs-you", timeoutMs), retry: 1, retryDelay: 150 });
  const items = boardQ.data?.items ?? NO_ITEMS;

  const combine = useCallback(
    (results: { data?: CardEnvelope; isError: boolean; isPending: boolean; error: unknown }[]): CardsResult => {
      const out: CardsResult = { cards: {}, failures: {}, pending: [] };
      results.forEach((q, n) => {
        const id = items[n].card;
        if (q.data) {
          // A failed refetch keeps the old envelope, marked stale. Its own last_good_at is never overwritten.
          out.cards[id] = q.isError ? { ...q.data, freshness: "stale" } : q.data;
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
    refetchBoard: () => boardQ.refetch(),
    needsYou: nyQ.data ?? NO_ENTRIES,
    needsYouStatus: nyQ.isError && !nyQ.data ? "error" : nyQ.data ? "ok" : "loading",
    refetchNeedsYou: () => nyQ.refetch(),
    ...cardsQ,
  };
}

/** CSRF headers for cookie-authenticated writes. Mirrors use-board-edit.ts exactly. */
export function csrfHeaders(): Record<string, string> {
  const m = typeof document !== "undefined" ? document.cookie.match(/(?:^|;\s*)pw_csrf=([^;]+)/) : null;
  return m ? { "X-CSRF-Token": decodeURIComponent(m[1]) } : {};
}

/** Read the server's plain-words detail from a JSON error body. */
export async function detailOf(res: Response): Promise<string> {
  try {
    const d = (await res.json()) as { detail?: unknown };
    return typeof d.detail === "string" ? d.detail : "";
  } catch {
    return "";
  }
}

/** C1 contract: write-like unless GET/HEAD, or effect=read with known_safe. */
export function isWriteRequest(r: { method: string; effect?: string; known_safe?: boolean }): boolean {
  if (r.method === "GET" || r.method === "HEAD") return false;
  if (r.effect === "read" && r.known_safe) return false;
  return true;
}

export const CONFIG_KEYS = {
  provider: ["fd", "config", "provider"] as const,
  request: ["fd", "config", "request"] as const,
  card: ["fd", "config", "card"] as const,
  action: ["fd", "config", "action"] as const,
};

/** POST JSON with optional CSRF, returning the Response without consuming the body. */
async function postJson(url: string, body: unknown, csrf = false): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), DEFAULT_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...(csrf ? csrfHeaders() : {}) },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
  } catch {
    throw new ApiError(ctl.signal.aborted ? "timeout" : "connection");
  } finally {
    clearTimeout(timer);
  }
}

export async function tryConnect(provider: unknown, request: unknown): Promise<TryResult> {
  const res = await postJson("/api/connect/try", { provider, request }, true);
  if (res.status === 422) {
    const detail = await detailOf(res);
    throw new ApiError("http_4xx", 422, detail);
  }
  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after");
    throw new ApiError("http_4xx", 429, retryAfter ?? "");
  }
  if (!res.ok) throw new ApiError(res.status >= 500 ? "http_5xx" : "http_4xx", res.status);
  return (await res.json()) as TryResult;
}

export async function previewCard(card: unknown, sampleOrRequest: { sample?: string; request?: string }): Promise<PreviewResult> {
  const body = sampleOrRequest.sample !== undefined ? { card, sample: sampleOrRequest.sample } : { card, request: sampleOrRequest.request };
  const res = await postJson("/api/connect/preview", body, true);
  if (res.status === 413) throw new ApiError("too_large", 413, await detailOf(res));
  if (res.status === 422) throw new ApiError("http_4xx", 422, await detailOf(res));
  if (!res.ok) throw new ApiError(res.status >= 500 ? "http_5xx" : "http_4xx", res.status);
  return (await res.json()) as PreviewResult;
}

/** GET /api/config/{kind}/{id}: returns the object and the etag from the response header. */
export async function fetchConfigItem<T>(kind: ConfigKind, id: string): Promise<{ object: T; etag: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`/api/config/${kind}/${id}`, { headers: { accept: "application/json" }, signal: ctl.signal });
  } catch {
    throw new ApiError(ctl.signal.aborted ? "timeout" : "connection");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 404) throw new ApiError("http_4xx", 404);
  if (!res.ok) throw new ApiError(res.status >= 500 ? "http_5xx" : "http_4xx", res.status);
  return { object: (await res.json()) as T, etag: res.headers.get("etag") ?? "" };
}

/** PUT /api/config/{kind}/{id}: returns the new object + new etag. Never dispatches a write. */
export interface SaveResult<T> { object: T; etag: string }
export async function saveConfigItem<T>(
  kind: ConfigKind,
  id: string,
  object: T,
  precondition: { ifMatch?: string; ifNoneMatch?: boolean },
): Promise<SaveResult<T>> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    ...csrfHeaders(),
  };
  if (precondition.ifMatch) headers["if-match"] = precondition.ifMatch;
  if (precondition.ifNoneMatch) headers["if-none-match"] = "*";
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`/api/config/${kind}/${id}`, { method: "PUT", headers, body: JSON.stringify(object), signal: ctl.signal });
  } catch {
    throw new ApiError(ctl.signal.aborted ? "timeout" : "connection");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 409) throw new ApiError("http_4xx", 409);
  if (res.status === 422) throw new ApiError("http_4xx", 422, await detailOf(res));
  if (!res.ok) throw new ApiError(res.status >= 500 ? "http_5xx" : "http_4xx", res.status);
  return { object: (await res.json()) as T, etag: res.headers.get("etag") ?? "" };
}

export interface ConnectData {
  providers: ConfigList<Provider>;
  providersStatus: Status;
  providersError?: string;
  refetchProviders: () => void;
  requests: ConfigList<ConnRequest>;
  requestsStatus: Status;
  requestsError?: string;
  refetchRequests: () => void;
  cards: ConfigList<CardConfig>;
  cardsStatus: Status;
  cardsError?: string;
  refetchCards: () => void;
  actions: ActionSummary[];
  actionsStatus: Status;
  refetchActions: () => void;
  receipts: Receipt[];
  receiptsStatus: Status;
  refetchReceipts: () => void;
  /** Merged errors from all config kinds. */
  allErrors: { kind: ConfigKind; file: string; reason: string }[];
}

const EMPTY_LIST = { items: [], errors: [] };
const NO_ACTIONS: ActionSummary[] = [];
const NO_RECEIPTS: Receipt[] = [];

/**
 * Connect's independent reads: each config kind, actions and receipts load on their own, and one failing
 * never hides the others.
 */
export function useConnectData(timeoutMs: number = DEFAULT_TIMEOUT_MS): ConnectData {
  const provQ = useQuery({
    queryKey: CONFIG_KEYS.provider,
    queryFn: () => getJson<ConfigList<Provider>>("/api/config/provider", timeoutMs),
    retry: 1,
    retryDelay: 150,
  });
  const reqQ = useQuery({
    queryKey: CONFIG_KEYS.request,
    queryFn: () => getJson<ConfigList<ConnRequest>>("/api/config/request", timeoutMs),
    retry: 1,
    retryDelay: 150,
  });
  const cardQ = useQuery({
    queryKey: CONFIG_KEYS.card,
    queryFn: () => getJson<ConfigList<CardConfig>>("/api/config/card", timeoutMs),
    retry: 1,
    retryDelay: 150,
  });
  const actQ = useQuery({
    queryKey: ["fd", "actions"],
    queryFn: () => getJson<ActionSummary[]>("/api/actions", timeoutMs),
    retry: 1,
    retryDelay: 150,
  });
  const recQ = useQuery({
    queryKey: ["fd", "receipts"],
    queryFn: () => getJson<Receipt[]>("/api/receipts?limit=10", timeoutMs),
    retry: 1,
    retryDelay: 150,
  });

  const statusOf = (q: { isError: boolean; data?: unknown }): Status =>
    q.isError && !q.data ? "error" : q.data ? "ok" : "loading";

  const mergeErrors = (): ConnectData["allErrors"] => {
    const out: ConnectData["allErrors"] = [];
    for (const e of provQ.data?.errors ?? []) out.push({ kind: "provider", file: e.file, reason: e.reason });
    for (const e of reqQ.data?.errors ?? []) out.push({ kind: "request", file: e.file, reason: e.reason });
    for (const e of cardQ.data?.errors ?? []) out.push({ kind: "card", file: e.file, reason: e.reason });
    return out;
  };

  return {
    providers: provQ.data ?? EMPTY_LIST,
    providersStatus: statusOf(provQ),
    providersError: provQ.isError ? "Couldn't load providers." : undefined,
    refetchProviders: () => void provQ.refetch(),
    requests: reqQ.data ?? EMPTY_LIST,
    requestsStatus: statusOf(reqQ),
    requestsError: reqQ.isError ? "Couldn't load requests." : undefined,
    refetchRequests: () => void reqQ.refetch(),
    cards: cardQ.data ?? EMPTY_LIST,
    cardsStatus: statusOf(cardQ),
    cardsError: cardQ.isError ? "Couldn't load cards." : undefined,
    refetchCards: () => void cardQ.refetch(),
    actions: actQ.data ?? NO_ACTIONS,
    actionsStatus: statusOf(actQ),
    refetchActions: () => void actQ.refetch(),
    receipts: recQ.data ?? NO_RECEIPTS,
    receiptsStatus: statusOf(recQ),
    refetchReceipts: () => void recQ.refetch(),
    allErrors: mergeErrors(),
  };
}
