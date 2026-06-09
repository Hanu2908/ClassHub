import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { registerSW } from 'virtual:pwa-register'
import { inject } from '@vercel/analytics'
import { injectSpeedInsights } from '@vercel/speed-insights'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import { reportAutomatedCrash } from './lib/crashTelemetry'

// ── Global Error & Promise Rejection Telemetry Listeners ─────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    // Ignore cross-origin third-party script loads which lack actionable traces
    if (event.message === 'Script error.') return;

    reportAutomatedCrash({
      title: `Global Error: ${event.message}`,
      error: event.error || new Error(event.message),
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(typeof event.reason === 'string' ? event.reason : 'Unhandled Promise Rejection');

    reportAutomatedCrash({
      title: `Global Promise Rejection: ${error.message}`,
      error,
    });
  });
}

// Initialize Vercel edge telemetry
if (typeof window !== 'undefined') {
  const initTelemetry = () => {
    inject();
    injectSpeedInsights();
  };
  if ('requestIdleCallback' in window) {
    requestIdleCallback(initTelemetry);
  } else {
    setTimeout(initTelemetry, 1500);
  }
}

// Register the PWA service worker automatically in production
if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}

// Self-healing: Unregister any active Service Workers on localhost to prevent aggressive browser caching
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      let unregisteredAny = false;
      const promises = [];
      for (const registration of registrations) {
        promises.push(
          registration.unregister().then((success) => {
            if (success) {
              console.log('[PWA] Unregistered active Service Worker in main.tsx');
              unregisteredAny = true;
            }
          })
        );
      }
      if (registrations.length > 0) {
        Promise.all(promises).then(() => {
          if (typeof caches !== 'undefined') {
            caches.keys().then((keys) => {
              Promise.all(keys.map((k) => caches.delete(k))).then(() => {
                if (navigator.serviceWorker.controller || unregisteredAny) {
                  console.log('[PWA] Service Worker controller detected. Reloading for fresh asset delivery...');
                  window.location.reload();
                }
              });
            });
          } else if (navigator.serviceWorker.controller || unregisteredAny) {
            window.location.reload();
          }
        });
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)

