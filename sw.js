// VentaControl Service Worker
// Estrategia: network-first para el HTML (siempre actualizado), cache-first para el resto
const CACHE = 'ventacontrol-v2.26';
const HTML_URL = './VentaControl_v2.html';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([HTML_URL, './manifest.json']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith(self.location.origin)) return;

  const isHTML = e.request.url.includes('VentaControl_v2.html') ||
                 e.request.url.endsWith('/') ||
                 e.request.url === self.location.origin + '/';

  if (isHTML) {
    // Network-first: siempre intenta descargar la versión más reciente.
    // Si no hay internet, usa la caché. Nunca hay que limpiar caché manualmente.
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Cache-first para manifest, íconos, fuentes, etc.
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }))
    );
  }
});
