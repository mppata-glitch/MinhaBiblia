const CACHE_NAME = 'biblia-nvi-v5';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json'
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
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Para requisições da API de livros e capítulos, fazemos cache automático.
    // Estratégia: Stale-while-revalidate (mostra o cache rápido, mas atualiza por trás)
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                
                const networkFetch = fetch(event.request).then((networkResponse) => {
                    // Atualiza o cache com a resposta mais recente
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                }).catch(() => {
                    // Se falhar a rede, não fazemos nada pois vamos retornar o cachedResponse (modo offline)
                });

                return cachedResponse || networkFetch;
            })
        );
        return;
    }

    // Para as rotas estáticas (HTML, JS), Cache First
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
