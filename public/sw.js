// Service worker mínimo: cachea el "shell" de la app (HTML, CSS, JS, logo) para que
// la interfaz cargue aunque no haya señal. Los datos de clima/sol-luna/Bortle siguen
// necesitando conexión (no se pueden calcular offline), pero la app no queda en blanco.
const CACHE_NAME = "astroturismo-cache-v1";
const RUTAS_BASICAS = ["/", "/logo.png", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(RUTAS_BASICAS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nombres) => Promise.all(nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Nunca cachear llamadas a /api/*: siempre deben ir a la red para traer datos actuales.
  if (event.request.url.includes("/api/")) return;

  event.respondWith(
    caches.match(event.request).then((respuestaCache) => {
      if (respuestaCache) return respuestaCache;
      return fetch(event.request)
        .then((respuestaRed) => {
          const copia = respuestaRed.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
          return respuestaRed;
        })
        .catch(() => caches.match("/"));
    })
  );
});
