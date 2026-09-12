/* ==========================================
   SERVICE WORKER (sw.js)
   ========================================== */

const CACHE_NAME = 'ruta-correntina-v27';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './script.js',
    './src/core/constants.js',
    './src/core/store.js',
    './src/utils/helpers.js',
    './src/utils/pwa.js',
    './src/config/firebase.js',
    './src/services/firebaseService.js',
    './src/services/geminiAi.js',
    './src/map/mapManager.js',
    './src/ui/uiManager.js',
    './src/ui/events.js'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Usamos addAll de forma segura o cache individual para evitar bloqueos si algún archivo falla
            return Promise.allSettled(
                ASSETS_TO_CACHE.map(asset => cache.add(asset).catch(err => {
                    console.warn(`No se pudo cachear el recurso: ${asset}`, err);
                }))
            );
        }).then(() => self.skipWaiting())
    );
});

// Activación y limpieza de cachés antiguas
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('Borrando caché antigua:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Interceptar peticiones de red
self.addEventListener('fetch', (event) => {
    // Excluir peticiones de Firebase, Firestore o APIs externas de la caché estricta
    if (event.request.url.includes('firestore.googleapis.com') || 
        event.request.url.includes('firebaseapp.com') || 
        event.request.url.includes('googleapis.com') ||
        event.request.url.includes('open-meteo.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                return networkResponse;
            }).catch(() => {
                // Si falla la red y es una navegación, se podría retornar el index.html offline
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});