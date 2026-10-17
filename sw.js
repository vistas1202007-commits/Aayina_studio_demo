'use strict';
const CACHE = 'aaina-public-v2';
const PUBLIC_PAGES = ['/', '/index.html', '/services.html', '/bridal.html', '/booking.html', '/app/', '/app/index.html', '/offline.html', '/privacy.html'];
const SHELL = [...PUBLIC_PAGES, '/style.css', '/refresh.css', '/services.css', '/bridal.css', '/booking.css', '/app/app.css', '/script.js', '/data.js', '/core.js', '/client.js', '/pwa.js', '/services.js', '/booking.js', '/app/app.js', '/favicon.svg', '/manifest.webmanifest'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('aaina-public-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/') || ['/runtime-config.js', '/sw.js', '/healthz'].includes(url.pathname)) return;
  if (event.request.mode === 'navigate') {
    if (!PUBLIC_PAGES.includes(url.pathname)) return;
    event.respondWith(fetch(event.request).then(response => { if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); } return response; }).catch(async () => (await caches.match(event.request)) || caches.match('/offline.html')));
    return;
  }
  if (!SHELL.includes(url.pathname) && !/^\/(images|icons)\/[\w.-]+\.(webp|jpg|png|svg)$/.test(url.pathname)) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); } return response; })));
});
