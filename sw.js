// SERVICE WORKER KILL SWITCH
// Unregisters itself + wipes every cache so users always get fresh JS/CSS from server.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', async () => {
  const cacheKeys = await caches.keys();
  await Promise.all(cacheKeys.map(k => caches.delete(k)));
  await self.registration.unregister();
});
