// V2 deliberately removes legacy caches, including cached private Supabase responses.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('frosti-'))await caches.delete(key);await self.clients.claim()})()));
// No private response or page caching. Mutations require a network connection.
