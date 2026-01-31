"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

// Default stale times for different data types
export const STALE_TIMES = {
  // Bootstrap data changes rarely during a gameweek
  bootstrap: 5 * 60 * 1000, // 5 minutes
  // Fixtures don't change often
  fixtures: 10 * 60 * 1000, // 10 minutes
  // Live data should be more fresh
  live: 30 * 1000, // 30 seconds
  // Manager data can be cached longer
  manager: 2 * 60 * 1000, // 2 minutes
  // League standings change after gameweeks
  league: 5 * 60 * 1000, // 5 minutes
  // Player summaries are relatively stable
  playerSummary: 5 * 60 * 1000, // 5 minutes
} as const;

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Don't refetch on window focus by default (can be overridden per query)
            refetchOnWindowFocus: false,
            // Retry failed requests up to 2 times
            retry: 2,
            // Default stale time
            staleTime: STALE_TIMES.bootstrap,
            // Keep unused data in cache for 10 minutes
            gcTime: 10 * 60 * 1000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
