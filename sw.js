/* ==========================================
   SERVICE WORKER (sw.js)
   ========================================== */

const CACHE_NAME = 'ruta-correntina-v38';
// Cachés aparte de la de assets: las teselas del mapa pesan decenas de MB y
// las fotos de favoritos se van agregando una por una con el tiempo — no
// tiene sentido que se borren cada vez que sube CACHE_NAME por un cambio de
// código (ver activate más abajo, que ahora conserva estas tres).
const TILES_CACHE = 'ruta-correntina-tiles-v1';
const FAVORITOS_IMG_CACHE = 'ruta-correntina-favoritos-img-v1';
const MAX_TILES_CACHEADAS = 400; // límite simple tipo FIFO, para no crecer sin techo

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './src/main.js',
    './src/core/constants.js',
    './src/core/store.js',
    './src/core/eventos.js',
    './src/utils/helpers.js',
    './src/utils/pwa.js',
    './src/utils/favoritosStore.js',
    './src/utils/offlineStatus.js',
    './src/config/firebase.js',
    './src/services/firebaseService.js',
    './src/services/geminiAi.js',
    './src/data/lugaresRepo.js',
    './src/data/eventosRepo.js',
    './src/data/reportesRepo.js',
    './src/data/perfilRepo.js',
    './src/core/rutasTematicas.js',
    './src/services/rutasTematicasUI.js',
    './src/services/asistenteLocalIA.js',
    './src/map/routing/rutaTematicaRenderer.js',
    './src/map/mapManager.js',
    './src/map/addPlaceManager.js',
    './src/map/reportManager.js',
    './src/map/routing/routingService.js',
    './src/map/popups/popupBuilder.js',
    './src/map/markers/lugarMarkers.js',
    './src/map/markers/eventoMarkers.js',
    './src/map/markers/reporteMarkers.js',
    './src/map/markers/estacionamientoMarkers.js',
    './src/map/transporte/deepLinks.js',
    './src/ui/authUI.js',
    './src/ui/uiManager.js',
    './src/ui/events.js',
    './src/ui/templates.js',
    './src/styles/main.css'
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

// Activación y limpieza de cachés antiguas (conserva las de teselas/favoritos,
// que no dependen de la versión del código y no queremos vaciar en cada deploy)
const CACHES_A_CONSERVAR = [CACHE_NAME, TILES_CACHE, FAVORITOS_IMG_CACHE];

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (!CACHES_A_CONSERVAR.includes(key)) {
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
    const url = event.request.url;

    // Excluir peticiones de Firebase, Firestore o APIs externas de la caché estricta
    if (url.includes('firestore.googleapis.com') ||
        url.includes('firebaseapp.com') ||
        url.includes('googleapis.com') ||
        url.includes('open-meteo.com')) {
        return;
    }

    // Teselas del mapa base (Leaflet + OpenStreetMap, ver src/map/mapManager.js):
    // cache-first con relleno en segundo plano. Antes esta app las dejaba pasar
    // por el mismo camino de abajo pero nunca llamaba a cache.put(), así que en
    // los hechos NUNCA se guardaban — el mapa no rendía nada sin conexión pese a
    // pasar por el service worker. Acá sí se cachean, en su propia caché.
    if (url.includes('tile.openstreetmap.org')) {
        event.respondWith(
            caches.open(TILES_CACHE).then(async (cache) => {
                const cacheada = await cache.match(event.request);
                if (cacheada) return cacheada;

                try {
                    const respuestaRed = await fetch(event.request);
                    if (respuestaRed.ok) {
                        cache.put(event.request, respuestaRed.clone());
                        limpiarCacheSiExcedeLimite(cache, MAX_TILES_CACHEADAS);
                    }
                    return respuestaRed;
                } catch (error) {
                    // Sin red y sin esa tesela cacheada: dejamos que Leaflet
                    // muestre el hueco gris en vez de romper toda la petición.
                    return new Response('', { status: 504, statusText: 'Sin conexión' });
                }
            })
        );
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

// FIFO simple: si se pasa del límite, borra la primera clave que encuentra.
// No es un LRU real (no trackea último uso), pero alcanza para no dejar
// crecer la caché de teselas sin límite en un dispositivo con poco espacio.
async function limpiarCacheSiExcedeLimite(cache, limite) {
    const claves = await cache.keys();
    if (claves.length > limite) {
        await cache.delete(claves[0]);
    }
}