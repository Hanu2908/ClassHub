import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';

// Clean up old outdated caches from previous builds
cleanupOutdatedCaches();

// Precaches all build assets compiled by Vite
precacheAndRoute(self.__WB_MANIFEST || []);

// ── Runtime Caching Rules ──

// Bypass Supabase API completely — always fetch fresh from network
registerRoute(
  ({ url }) => url.hostname.includes("supabase"),
  new NetworkFirst()
);

// Cache-first strategy for runtime image requests (avatars, attachments, dynamic assets)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'classhub-images-cache',
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

// ── Push Notifications (Preserved from original sw.js) ──

self.addEventListener("push", (e) => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || "ClassHub";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/app/home" },
    vibrate: [100, 50, 100],
    tag: data.tag || "classhub-" + Date.now(),
    renotify: true,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification Click (Navigate or Focus application tab) ──

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
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
