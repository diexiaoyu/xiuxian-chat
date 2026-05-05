self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
  // 跳过对 manifest.json 的缓存
  if (event.request.url.includes('manifest.json')) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(fetch(event.request));
});
