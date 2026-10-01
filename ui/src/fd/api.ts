import { useQueries, useQuery } from "@tanstack/react-query";
import type { Board, CardEnvelope, NeedsYouEntry } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return (await res.json()) as T;
}

export interface HomeData {
  board: Board | undefined;
  needsYou: NeedsYouEntry[];
  cards: Record<string, CardEnvelope>;
  loading: boolean;
  /** The board itself could not be loaded. A single card failing never sets this. */
  error: boolean;
  /** Card ids whose fetch failed; the row shows Unknown, never 0. */
  failed: string[];
}

export function useHomeData(): HomeData {
  const boardQ = useQuery({ queryKey: ["fd", "board", "home"], queryFn: () => getJson<Board>("/api/boards/home") });
  const nyQ = useQuery({ queryKey: ["fd", "needs-you"], queryFn: () => getJson<NeedsYouEntry[]>("/api/needs-you") });
  const items = boardQ.data?.items ?? [];
  const cardQs = useQueries({
    queries: items.map((i) => ({ queryKey: ["fd", "card", i.card], queryFn: () => getJson<CardEnvelope>(`/api/cards/${i.card}`) })),
  });
  const cards: Record<string, CardEnvelope> = {};
  const failed: string[] = [];
  cardQs.forEach((q, n) => {
    if (q.data) cards[items[n].card] = q.data;
    else if (q.isError) failed.push(items[n].card);
  });
  return { board: boardQ.data, needsYou: nyQ.data ?? [], cards, loading: boardQ.isLoading || cardQs.some((q) => q.isLoading), error: boardQ.isError, failed };
}
