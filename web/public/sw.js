// Mosaic service worker: caches the app shell only (HTML + built JS/CSS + icons) so the app opens offline.
// Supabase API and storage calls are cross-origin and never touched here; the board data has its own IndexedDB queue.
const CACHE = 'mosaic-shell-v1'
const SHELL = ['/', '/manifest.webmanifest', '/mosaic-icon-192.png', '/mosaic-icon-512.png', '/favicon-32.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const isAsset = (url) => url.pathname.startsWith('/assets/') || /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname)

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase, fonts, link previews: network only

  if (req.mode === 'navigate') {
    // Network first so a deploy shows up at once; fall back to the cached shell when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)) }
          return res
        })
        .catch(() => caches.match('/').then((r) => r ?? Response.error())),
    )
    return
  }
  if (isAsset(url)) {
    // Built files have hashed names: cache first, fill on miss.
    event.respondWith(
      caches.match(req).then((hit) => hit ?? fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
        return res
      })),
    )
  }
})
