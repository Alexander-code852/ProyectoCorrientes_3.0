const CACHE_NAME = 'ruta-correntina-v12';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './firebase.js',
    './lugares.json',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                          .map(name => caches.delete(name))
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request).then(fetchRes => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request.url, fetchRes.clone());
                        return fetchRes;
                    });
                });
            }).catch(() => {
                console.log('Modo Offline Activo.');
            })
        );
    }
});