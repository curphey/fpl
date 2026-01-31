"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { STALE_TIMES } from "@/lib/cache-config";

// Re-export STALE_TIMES for backwards compatibility
export { STALE_TIMES };

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
