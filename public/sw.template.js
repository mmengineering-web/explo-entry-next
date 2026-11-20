// Offline shell for Explo Entry. Generated into out/sw.js by scripts/make-sw.mjs (do not edit out/sw.js).
const CACHE = "__VERSION__";
const PRECACHE = __PRECACHE__;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => (k.startsWith("exp-next-") && k !== CACHE) || k.startsWith("exp-pwa-")).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  // only our own GET files; Supabase, map tiles and everything cross-origin go straight to the network
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put("/", c)); return r; }).catch(() => caches.match("/")));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});

self.addEventListener("sync", e => {
  if (e.tag === "exp-sync") e.waitUntil(self.clients.matchAll().then(cs => cs.forEach(c => c.postMessage("exp-sync"))));
});
