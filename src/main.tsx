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
import * as Sentry from '@sentry/react'

if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

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

// Define a page load timestamp to guard against mid-session auto-reloads
const PAGE_LOAD_TIME = Date.now();

// Expose the reload transition globally so it can be called from React
(window as any).triggerPwaUpdateReload = () => {
  if (document.getElementById('pwa-update-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'pwa-update-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(10, 12, 20, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
    font-family: var(--font-display, 'Outfit', system-ui, sans-serif);
    color: #ffffff;
  `;

  overlay.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 24px; text-align: center;">
      <div style="
        width: 40px;
        height: 40px;
        border: 3px solid rgba(99, 102, 241, 0.1);
        border-top: 3px solid #6366f1;
        border-radius: 50%;
        animation: sw-spin 0.8s linear infinite;
      "></div>
      <div>
        <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 600; letter-spacing: -0.01em;">Updating ClassHub</h3>
        <p style="margin: 0; font-size: 13px; color: #a1a1aa;">Applying the latest features...</p>
      </div>
    </div>
    <style>
      @keyframes sw-spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;

  document.body.appendChild(overlay);

  // Animate opacity fade-in
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
  });

  // Store flag in sessionStorage and reload
  setTimeout(() => {
    sessionStorage.setItem('classhub_just_updated', 'true');
    window.location.reload();
  }, 600);
};

// Register the PWA service worker automatically in production
if (import.meta.env.PROD) {
  registerSW({ immediate: true });

  if ('serviceWorker' in navigator) {
    // Only reload if the page was already controlled by a service worker on load
    const isControlled = !!navigator.serviceWorker.controller;
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (isControlled && !refreshing) {
        refreshing = true;
        const timeSinceLoad = Date.now() - PAGE_LOAD_TIME;

        if (timeSinceLoad < 6000) {
          // User just opened the app, auto-reload with the transition overlay
          if (typeof (window as any).triggerPwaUpdateReload === 'function') {
            (window as any).triggerPwaUpdateReload();
          } else {
            window.location.reload();
          }
        } else {
          // User is active, dispatch event to let React show a Toast prompt
          window.dispatchEvent(new CustomEvent('classhub-pwa-update-available'));
        }
      }
    });
  }
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

