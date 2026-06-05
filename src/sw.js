import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { pruneExpiredShares, stageShare } from './lib/shareInbox';

// Clean up old outdated caches from previous builds
cleanupOutdatedCaches();

// Precaches all build assets compiled by Vite
precacheAndRoute(self.__WB_MANIFEST || []);

// ── Runtime Caching Rules ──

// Cache Google Fonts stylesheets with Stale-While-Revalidate
registerRoute(
  ({ url, request }) => request.method === 'POST' && url.pathname === '/share-target',
  async ({ request }) => {
    try {
      await pruneExpiredShares();
      const formData = await request.formData();
      const files = formData.getAll('files').filter((value) => value instanceof File);
      
      // Extract standard PWA share fields (title, text, url)
      const title = formData.get('title');
      const text = formData.get('text');
      const shareUrl = formData.get('url');
      let caption = formData.get('caption') || '';
      
      const parts = [];
      if (title && typeof title === 'string') parts.push(title.trim());
      if (text && typeof text === 'string') parts.push(text.trim());
      if (shareUrl && typeof shareUrl === 'string') parts.push(shareUrl.trim());
      
      if (parts.length > 0) {
        const merged = parts.join('\n');
        caption = caption ? `${caption.trim()}\n\n${merged}` : merged;
      }
      
      const entry = await stageShare(files, typeof caption === 'string' ? caption : '');
      return Response.redirect(new URL(`/share-intake?id=${encodeURIComponent(entry.id)}`, self.location.origin).toString(), 303);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'invalid-share';
      return Response.redirect(new URL(`/share-intake?error=${encodeURIComponent(code)}`, self.location.origin).toString(), 303);
    }
  },
  'POST'
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
  })
);

// Cache Google Fonts webfont files with Cache-First strategy and long expiration (1 year)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 Year
      }),
    ],
  })
);

// Cache-first strategy for runtime image requests (avatars, attachments, dynamic assets)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'classhub-images-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days max age
      }),
    ],
  })
);

// Fallback navigation handler: if offline and route is navigation (html doc), serve cached index.html
const navigationRouteHandler = new NetworkFirst();
registerRoute(
  ({ request }) => request.mode === 'navigate',
  async (params) => {
    try {
      return await navigationRouteHandler.handle(params);
    } catch {
      return (await matchPrecache('/index.html')) || Response.error();
    }
  }
);

import { getSession, enqueueAction, getQueuedActions, dequeueAction } from './lib/offlineDb';


function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil(
    getSession().then(async (session) => {
      if (!session || !session.token) {
        console.warn('[SW PushChange] No active session. Skipping self-heal.');
        return;
      }

      const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!VAPID_PUBLIC_KEY) {
        console.warn('[SW PushChange] VITE_VAPID_PUBLIC_KEY env var is missing.');
        return;
      }

      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const newSub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });

      const json = newSub.toJSON();

      const res = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions`, {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${session.token}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          user_id: session.userId,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth
        })
      });

      if (res.ok) {
        console.log('[SW PushChange] Subscription self-healing completed successfully!');
      } else {
        console.warn('[SW PushChange] Subscription self-healing failed with status:', res.status, await res.text());
      }
    }).catch(err => {
      console.error('[SW PushChange] Subscription healing failed:', err);
    })
  );
});

// ── Push Notifications ──

self.addEventListener("push", (e) => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || "ClassHub";
  const options = {
    body: data.body || "",
    icon: "/icon_192.png",
    badge: "/badge-cropped.svg",
    data: { 
      url: data.url || "/app/home",
      announcementId: data.announcementId,
      type: data.type
    },
    vibrate: [100, 50, 100],
    tag: data.tag || "classhub-generic",
    renotify: true,
    actions: data.actions || [],
  };

  // Only show OS notification if no focused ClassHub tab is visible.
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const hasFocusedClient = clientList.some(
          (client) =>
            client.url.startsWith(self.location.origin) &&
            "focus" in client &&
            client.focused
        );
        if (!hasFocusedClient) {
          return self.registration.showNotification(title, options);
        }
      })
  );
});

// ── Notification Click & Custom Lock-Screen Actions ──

self.addEventListener("notificationclick", (e) => {
  e.notification.close();

  // Vector 1: Interactive Silent Lock-Screen Acknowledgment
  if (e.action === 'ack') {
    const { announcementId } = e.notification.data;
    
    e.waitUntil(
      getSession().then(async (session) => {
        if (!session || !session.token || !session.userId) {
          console.warn('[SW Click] No active session found. Enqueuing for offline sync...');
          await enqueueAction('acknowledge', { announcementId, userId: 'null-fallback' });
          return;
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        try {
          const res = await fetch(`${supabaseUrl}/rest/v1/acknowledgments`, {
            method: 'POST',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${session.token}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
              announcement_id: announcementId,
              user_id: session.userId
            })
          });

          if (res.ok || res.status === 409) {
            console.log('[SW Click] Silent background acknowledgment successful!');
          } else {
            const text = await res.text();
            if (text.includes('23505')) {
              console.log('[SW Click] Already acknowledged.');
            } else {
              throw new Error(`Server returned ${res.status}: ${text}`);
            }
          }
        } catch (err) {
          console.warn('[SW Click] Background acknowledgment failed due to network. Enqueuing offline action:', err);
          await enqueueAction('acknowledge', { announcementId, userId: session.userId });
          // Register background sync if supported
          if ('sync' in self.registration) {
            await self.registration.sync.register('sync-offline-actions').catch((syncErr) => {
              console.warn('[SW Click] Failed to register background sync tag:', syncErr);
            });
          }
        }
      })
    );
    return;
  }

  // Standard click: Navigate or focus active client window
  const url = (e.notification.data && e.notification.data.url) || "/app/home";
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.indexOf(self.location.origin) !== -1 && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

// ── Background Sync & Client Communication ──

self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-offline-actions') {
    e.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_SYNC_PLAYBACK' });
        });
      })
    );
  }
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SYNC_ACTIONS') {
    e.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_SYNC_PLAYBACK' });
        });
      })
    );
  }
});

