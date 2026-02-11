/* ==========================================
   SERVICE WORKER - MODO OFFLINE (PWA)
   ========================================== */
const CACHE_NAME = 'ruta-correntina-v4-ultimate';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './firebase.js',
  './lugares.json',
  './manifest.json',
  './logo.png',
  // CDNs Esenciales (Cacheamos para que carguen offline)
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.css',
  'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js',
  'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js'
];

// 1. INSTALACIÓN: Cachear recursos estáticos
self.addEventListener('install', (e) => {
  console.log('[SW] Instalando...');
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. ACTIVACIÓN: Limpiar cachés viejas
self.addEventListener('activate', (e) => {
  console.log('[SW] Activado');
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 3. FETCH: Estrategia "Network First, falling back to Cache" para datos
// Para assets estáticos usamos "Cache First"
self.addEventListener('fetch', (e) => {
  // Ignorar peticiones a Firestore/Google APIs (tienen su propio manejo)
  if (e.request.url.includes('firestore') || e.request.url.includes('googleapis')) return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      // Si está en caché, lo devolvemos
      if (cachedResponse) {
        // Actualizamos en segundo plano (Stale-while-revalidate)
        fetch(e.request).then((networkResponse) => {
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(e.request, networkResponse.clone());
            });
        }).catch(() => {}); // Si falla la red, no pasa nada
        return cachedResponse;
      }

      // Si no está en caché, vamos a la red
      return fetch(e.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, networkResponse.clone());
          return networkResponse;
        });
      });
    }).catch(() => {
        // Fallback offline (opcional: podrías retornar una página offline.html aquí)
        console.log('[SW] Fallo de red y sin caché');
    })
  );
});