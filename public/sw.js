// Service Worker minimal pour rendre Frosti installable en PWA.
// Stratégie "network-first" : on va toujours chercher la dernière version
// sur le réseau en priorité, et on ne se rabat sur le cache qu'en cas
// d'échec réseau (mode hors-ligne). Ça évite de revivre le problème de
// version périgée bloquée en cache sur mobile.

const CACHE_NAME = 'frosti-cache-v1'; // ⚠️ Incrémente ce numéro (v2, v3...)
                                       // si tu changes un jour la stratégie
                                       // de cache elle-même.

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Active immédiatement la nouvelle version du SW
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Nettoie les anciens caches
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      // Prend le contrôle immédiat de toutes les pages ouvertes
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  // On ne gère que les requêtes GET (navigation, assets)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      try {
        // 1. On tente toujours le réseau en premier
        const networkResponse = await fetch(event.request);
        // On met à jour le cache avec la dernière version au passage
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
      } catch (err) {
        // 2. Hors-ligne : on retombe sur le cache si disponible
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw err;
      }
    })()
  );
});
