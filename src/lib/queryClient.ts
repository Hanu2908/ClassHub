import { QueryClient, dehydrate, hydrate } from '@tanstack/react-query';

const CACHE_KEY = 'classhub_query_cache';

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

// Load and hydrate cache immediately on client startup to avoid empty screens
try {
  const cachedState = localStorage.getItem(CACHE_KEY);
  if (cachedState) {
    const parsed = JSON.parse(cachedState);
    hydrate(queryClient, parsed);
  }
} catch (e) {
  console.error('[Cache] Failed to restore query cache from localStorage:', e);
}

// Persist successful query updates to localStorage with a 1s debounce
let saveTimeout: number | undefined;
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.query.state.status === 'success') {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = window.setTimeout(() => {
      try {
        const state = dehydrate(queryClient, {
          shouldDehydrateQuery: (query) => {
            // Persist all successfully fetched queries
            return query.state.status === 'success';
          },
        });
        localStorage.setItem(CACHE_KEY, JSON.stringify(state));
      } catch (e) {
        console.error('[Cache] Failed to save query cache to localStorage:', e);
      }
    }, 1000);
  }
});

