import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s — avoids refetch spam
      retry: 1,                 // retry once on network error
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
