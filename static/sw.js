const CACHE_NAME = 'minhabiblia-cache-v1.2.2';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    '/favicon.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Apenas requisições GET podem ser colocadas no cache (evita erros no POST do Analytics)
    if (event.request.method !== 'GET') {
        return;
    }

    // Stale-while-revalidate para TUDO: HTML, JS, e APIs.
    // Assim o app abre super rápido (offline) mas sempre baixa a versão mais nova por trás.
    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(event.request);
            
            const networkFetch = fetch(event.request).then((networkResponse) => {
                // Atualiza o cache apenas se a resposta for bem-sucedida (status 200-299)
                if (networkResponse.ok) {
                    cache.put(event.request, networkResponse.clone());
                }
                return networkResponse;
            }).catch((err) => {
                // Se falhar a rede e não houver cache, propaga o erro para o frontend tratar
                if (!cachedResponse) {
                    throw err;
                }
            });

            return cachedResponse || networkFetch;
        })
    );
});
