const CACHE = "ClassHub-v2";
const STATIC = ["/manifest.json", "/favicon.svg", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  // Dev mode bypass: do not intercept anything on localhost or 127.0.0.1
  if (self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1") {
    return;
  }

  const url = new URL(e.request.url);

  // Skip non-GET and cross-origin requests
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Always network-first for HTML navigation (SPA routes)
  if (
    e.request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname.endsWith(".html")
  ) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/index.html")),
    );
    return;
  }

  // Skip Supabase API calls — always go to network
  if (url.hostname.includes("supabase")) return;

  // Cache-first for JS, CSS, fonts, images
  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        }),
    ),
  );
});

// ── Push Notification ──
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

// ── Notification Click — navigate to target URL ──
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/app/home";
  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.indexOf(self.location.origin) !== -1 && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      }),
  );
});
