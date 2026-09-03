const CACHE_NAME = 'agenda-store-v2'; // Mude a versão para forçar a renovação
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js'
];

// Instala e armazena os arquivos novos
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Pula a espera e ativa imediatamente
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Ativa e limpa os caches antigos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key); // Apaga versões velhas do cache
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // Assume o controle de todas as abas abertas
    })
  );
});

// Intercepta as requisições buscando a versão mais nova na rede, ou fallback pro cache
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // Opcional: atualiza o cache em segundo plano se houver conexão
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // Se estiver sem internet, usa o cache
        return caches.match(e.request);
      })
  );
});