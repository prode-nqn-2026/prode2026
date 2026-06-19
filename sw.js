importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAsDIA9Y3W8HEmSjTaWI7cnTR4X5esE9rU",
  authDomain: "prode2026-ecd26.firebaseapp.com",
  projectId: "prode2026-ecd26",
  storageBucket: "prode2026-ecd26.firebasestorage.app",
  messagingSenderId: "748658807388",
  appId: "1:748658807388:web:fcf7b6f69a3bf296118c99"
});
firebase.messaging(); // habilita la recepción de push en background automáticamente

const CACHE = 'prode2026-v48';
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
