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

// ---------- Push-уведомления (src/push.js, public/api/push.php) ----------

const PUSH_ICON = '/apple-touch-icon.png'
const PUSH_BADGE = '/push-badge.png'

// Расписание сервер не знает: предмет и кабинет подставляем из копии в кэше.
async function personalize(push) {
  if (!push.bell || (push.kind !== 'lesson-start' && push.kind !== 'lesson-end')) return push
  let lessons = []
  try {
    const cached = await (await caches.open('push-data')).match('/__push/schedule.json')
    lessons = cached ? await cached.json() : []
  } catch { return push }
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const todays = lessons.filter((lesson) => lesson.date === today).sort((a, b) => a.start.localeCompare(b.start))
  if (push.kind === 'lesson-start') {
    const lesson = todays.find((item) => item.start === push.bell.start)
    if (!lesson) return push
    return { ...push, title: `Через 5 минут: ${lesson.subject}`, body: `${lesson.room}, начало в ${lesson.start}. Маршрут уже готов.`, url: `/route?to=${encodeURIComponent(lesson.roomId)}`, route: true }
  }
  const finished = todays.find((item) => item.end === push.bell.end)
  const next = todays.find((item) => item.start >= push.bell.end)
  if (!finished && !next) return push
  return {
    ...push,
    title: finished ? `${finished.subject}: пара закончилась` : push.title,
    body: next ? `Дальше ${next.subject}, ${next.room} в ${next.start}.` : push.body,
    url: next ? `/route?to=${encodeURIComponent(next.roomId)}` : push.url,
    route: Boolean(next),
  }
}

self.addEventListener('push', (event) => {
  let push
  try { push = event.data ? event.data.json() : {} } catch { push = { body: event.data ? event.data.text() : '' } }
  event.waitUntil(personalize({ title: 'ЛОГОС', body: '', url: '/', kind: 'news', ...push }).then((item) => self.registration.showNotification(item.title, {
    body: item.body,
    icon: PUSH_ICON,
    badge: PUSH_BADGE,
    tag: item.tag || item.kind,
    renotify: true,
    timestamp: item.ts ? item.ts * 1000 : Date.now(),
    data: { url: item.url || '/' },
    actions: item.route ? [{ action: 'open', title: 'Маршрут' }] : [],
  })))
})

// Нажатие на уведомление: открытая вкладка сайта переходит по ссылке, иначе открываем новую.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin)
  if (target.origin !== self.location.origin) return
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
    const open = windows.find((client) => new URL(client.url).origin === target.origin)
    if (open) {
      await open.focus()
      return open.navigate ? open.navigate(target.href) : null
    }
    return self.clients.openWindow(target.href)
  }))
})

// Браузер сам сменил подписку (истёк срок): сервер переносит на новую темы старой.
self.addEventListener('pushsubscriptionchange', (event) => {
  const old = event.oldSubscription
  event.waitUntil((async () => {
    const options = old?.options || event.newSubscription?.options
    if (!options?.applicationServerKey) return
    const subscription = event.newSubscription || await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: options.applicationServerKey })
    await fetch('/api/push.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'subscribe', subscription: subscription.toJSON(), previous: old?.endpoint || '' }) })
  })())
})
