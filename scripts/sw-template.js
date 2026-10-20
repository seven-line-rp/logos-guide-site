/* global __PRECACHE__ */
// Сервис-воркер путеводителя: после первого визита сайт открывается и без сети.
// Файл собирается из этого шаблона плагином в vite.config.js: он подставляет
// список файлов сборки и её хеш в PRECACHE и VERSION.
// Новая сборка — новый кэш, старый удаляется при активации.

const VERSION = '__VERSION__'
const CACHE = `logos-${VERSION}`
const PRECACHE = __PRECACHE__

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith('logos-') && key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()))
})

async function fromNetwork(request, cacheKey = request) {
  const response = await fetch(request)
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE)
    cache.put(cacheKey, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // ИИ-агент, сообщения об ошибках и прочие запросы к серверу — только из сети.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  // Страницы приложения: сначала сеть (свежая версия), без сети — сохранённая оболочка.
  if (request.mode === 'navigate') {
    event.respondWith(fromNetwork(request, '/index.html').catch(async () => (await caches.match('/index.html')) || Response.error()))
    return
  }

  // Объявления меняются без пересборки — тоже сначала сеть.
  if (url.pathname === '/notices.json') {
    event.respondWith(fromNetwork(request).catch(async () => (await caches.match(request)) || Response.error()))
    return
  }

  // Файлы сборки с хешем в имени и картинки: из кэша, иначе из сети с сохранением.
  event.respondWith(caches.match(request, { ignoreSearch: url.pathname.startsWith('/assets/') }).then((cached) => cached || fromNetwork(request)))
})
