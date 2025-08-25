// sw.js
const CACHE = "advisor-cache-v1";
const APP_SHELL = [
  "/",                 
  "/style.css",
  "/app/index.js",
  "/assets/favicon.png",
  "/assets/background/ai-bg1.png",
  "/assets/background/ai-bg2.png",
  "/assets/background/ai-bg3.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // Network-first for API, cache-first for static
  if (req.url.includes("/api/")) {
    e.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
  } else {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req))
    );
  }
});
