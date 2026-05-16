const CACHE = "ClassHub-v1"; // bumped again to kill v2 cache
const STATIC = ["/manifest.json"];

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
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: "window", includeUncontrolled: true }),
      )
      .then((clients) => {
        clients.forEach((client) => client.navigate(client.url));
      }),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Always network-first for HTML navigation
  if (
    e.request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname.endsWith(".html")
  ) {
    e.respondWith(fetch(e.request).catch(() => caches.match("/index.html")));
    return;
  }

  // Cache-first for JS, CSS, fonts, images
  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        }),
    ),
  );
});
