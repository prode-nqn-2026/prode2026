const CACHE = 'prode2026-v34';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './Trionda.png',
  './icon-192.png',
  './icon-512.png',
  './fondo.png'
];

// Instalación: cachear assets estáticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activación: limpiar cachés viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first para la API, cache-first para assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Llamadas a la API de Google Apps Script → siempre red
  if (url.hostname.includes('script.google.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response(
      JSON.stringify({ ok: false, mensaje: 'Sin conexión' }),
      { headers: { 'Content-Type': 'application/json' } }
    )));
    return;
  }

  // Assets propios → cache first, fallback a red
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      // Solo cachear respuestas válidas del mismo origen
      if (res.ok && url.origin === self.location.origin) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});
