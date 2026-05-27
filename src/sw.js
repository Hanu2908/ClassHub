import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Clean up old outdated caches from previous builds
cleanupOutdatedCaches();

// Precaches all build assets compiled by Vite
precacheAndRoute(self.__WB_MANIFEST || []);

// ── Runtime Caching Rules ──

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
      return (await caches.match('/index.html')) || Response.error();
    }
  }
);

// ── Lightweight Self-Contained IndexedDB Wrappers ──
const DB_NAME = 'classhub-offline';

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function getDBSession() {
  return openOfflineDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('auth-session', 'readonly');
      const store = transaction.objectStore('auth-session');
      const request = store.get('session');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }).catch((err) => {
    console.error('[SW DB] Failed to get session:', err);
    return null;
  });
}

function enqueueDBAction(type, payload) {
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const action = { id, type, payload, timestamp: Date.now() };
  return openOfflineDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('offline-actions', 'readwrite');
      const store = transaction.objectStore('offline-actions');
      const request = store.put(action);
      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }).catch((err) => {
    console.error('[SW DB] Failed to enqueue action:', err);
    return id;
  });
}

function getDBQueuedActions() {
  return openOfflineDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('offline-actions', 'readonly');
      const store = transaction.objectStore('offline-actions');
      const request = store.getAll();
      request.onsuccess = () => {
        const actions = request.result || [];
        actions.sort((a, b) => a.timestamp - b.timestamp);
        resolve(actions);
      };
      request.onerror = () => reject(request.error);
    });
  }).catch((err) => {
    console.error('[SW DB] Failed to fetch queued actions:', err);
    return [];
  });
}

function dequeueDBAction(id) {
  return openOfflineDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('offline-actions', 'readwrite');
      const store = transaction.objectStore('offline-actions');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }).catch((err) => {
    console.error('[SW DB] Failed to dequeue action:', err);
  });
}

// ── Background Sync Engine Playback ──
async function playbackOfflineActionsSW() {
  const session = await getDBSession();
  if (!session || !session.token) {
    console.warn('[SW Sync] No active session found in IndexedDB. Skipping playback.');
    return;
  }

  const actions = await getDBQueuedActions();
  if (actions.length === 0) return;

  console.log(`[SW Sync] Playing back ${actions.length} offline actions from service worker...`);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  for (const action of actions) {
    try {
      if (action.type === 'acknowledge') {
        const { announcementId, userId } = action.payload;
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
            user_id: userId === 'null-fallback' ? session.userId : userId
          })
        });

        if (res.ok || res.status === 409) {
          await dequeueDBAction(action.id);
        } else {
          const text = await res.text();
          if (text.includes('23505') || text.includes('already exists')) {
            await dequeueDBAction(action.id);
          } else {
            console.error(`[SW Sync] Temporary failure for acknowledgment ${action.id}:`, res.status, text);
            break; // Hold queue order on server errors
          }
        }
      } else if (action.type === 'vote') {
        const { pollId, optionId, pollType, allowMultiple, isSelected, userId } = action.payload;
        const isAnonymous = pollType === 'general' || pollType === 'anonymous';
        let token = null;

        const activeUserId = userId === 'null-fallback' ? session.userId : userId;

        if (isAnonymous) {
          const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/calculate_anonymous_token`, {
            method: 'POST',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${session.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              user_id: activeUserId,
              poll_id: pollId
            })
          });
          if (rpcRes.ok) {
            token = await rpcRes.json();
          } else {
            throw new Error(`Failed to compute anonymous token: ${await rpcRes.text()}`);
          }
        }

        let success = false;
        let deleteErr = false;

        const queryParams = new URLSearchParams();
        if (allowMultiple) {
          queryParams.append('option_id', `eq.${optionId}`);
        } else {
          queryParams.append('poll_id', `eq.${pollId}`);
        }
        if (isAnonymous) {
          queryParams.append('anonymous_token', `eq.${token}`);
        } else {
          queryParams.append('student_id', `eq.${activeUserId}`);
        }

        const delRes = await fetch(`${supabaseUrl}/rest/v1/votes?${queryParams.toString()}`, {
          method: 'DELETE',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${session.token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!delRes.ok) {
          deleteErr = true;
        }

        let insertErr = false;
        if (!deleteErr && (!allowMultiple || !isSelected)) {
          const insRes = await fetch(`${supabaseUrl}/rest/v1/votes`, {
            method: 'POST',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${session.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              poll_id: pollId,
              option_id: optionId,
              student_id: isAnonymous ? null : activeUserId,
              anonymous_token: token
            })
          });

          if (!insRes.ok) {
            const insText = await insRes.text();
            if (insText.includes('23505') || insRes.status === 409) {
              // Already exists, treat as success
            } else {
              insertErr = true;
            }
          }
        }

        if (!deleteErr && !insertErr) {
          await dequeueDBAction(action.id);
        } else {
          console.error(`[SW Sync] Temporary failure for vote ${action.id}`);
          break; // Hold queue order
        }
      }
    } catch (err) {
      console.error(`[SW Sync] Failed to playback action ${action.id}:`, err);
      break;
    }
  }
}

// ── Push Notifications ──

self.addEventListener("push", (e) => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || "ClassHub";
  const options = {
    body: data.body || "",
    icon: "/icon_192.png",
    badge: "/badge.svg",
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
      getDBSession().then(async (session) => {
        if (!session || !session.token || !session.userId) {
          console.warn('[SW Click] No active session found. Enqueuing for offline sync...');
          await enqueueDBAction('acknowledge', { announcementId, userId: 'null-fallback' });
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
          await enqueueDBAction('acknowledge', { announcementId, userId: session.userId });
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
    e.waitUntil(playbackOfflineActionsSW());
  }
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SYNC_ACTIONS') {
    e.waitUntil(playbackOfflineActionsSW());
  }
});
