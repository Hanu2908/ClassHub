import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s — avoids refetch spam
      retry: 1,                 // retry once on network error
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst',  // return cached data immediately when offline
    },
    mutations: {
      retry: 0,
      networkMode: 'offlineFirst',
    },
  },
});

