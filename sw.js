/* ============================================================
   MY STUDY TIMER — sw.js
   Phase 10 (PWA): offline support. Cache-first with background
   refresh (stale-while-revalidate). Bump VERSION to bust cache.
   ============================================================ */
const VERSION = "mst-v1.0.0";
const CORE = [
  "./", "index.html", "settings.html", "manifest.json",
  "css/themes.css", "css/main.css", "css/components.css",
  "js/storage.js", "js/themes.js", "js/sounds.js", "js/activity.js",
  "js/stats.js", "js/timer.js", "js/app.js", "js/settings.js",
  "assets/icons/favicon.svg", "assets/icons/icon-192.png", "assets/icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req).then((cached) => {
      const fresh = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
