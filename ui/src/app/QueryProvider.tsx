/**
 * QueryProvider — TanStack Query context for Project Worlds.
 *
 * Manages server-state lifecycle: loading, stale, retry, refresh, unavailable, cached.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const defaultQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s — data is fresh
      gcTime: 5 * 60_000,       // 5min — keep in cache
      retry: 2,                  // retry twice on failure
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

interface QueryProviderProps {
  children: React.ReactNode;
  client?: typeof defaultQueryClient;
}

export function QueryProvider({ children, client }: QueryProviderProps) {
  const [queryClient] = useState(() => client || defaultQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

export { defaultQueryClient };
