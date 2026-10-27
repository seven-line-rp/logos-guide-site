import { rooms } from './data.js'
import { readSchedule, subscribeSchedule } from './schedule.js'
import { storageGet, storageSet } from './storage.js'
import { SITE_VERSION_LABEL } from './version.js'

// Push-уведомления (тестовый режим, страница /testNotification). Браузер
// подписывается через сервис-воркер, подписка и выбранные темы уходят в
// public/api/push.php. Расписание пар сервер не видит: перед каждым
// уведомлением о паре сервис-воркер сам подставляет из него предмет и кабинет
// (копия лежит в кэше браузера, см. syncScheduleForPush). Настройка — deploy/push.md.

export const PUSH_API = '/api/push.php'
export const PUSH_TOPICS_KEY = 'logos-push-topics'
// Кэш, из которого сервис-воркер читает расписание. Не начинается с «logos-»,
// иначе его удалит очистка старых версий сайта в sw.js.
export const PUSH_DATA_CACHE = 'push-data'
export const PUSH_SCHEDULE_URL = '/__push/schedule.json'

export const PUSH_TOPICS = [
  { id: 'lessons', title: 'Пары', hint: 'За 5 минут до начала и в конце пары, по звонкам' },
  { id: 'events', title: 'События', hint: 'Концерты, собрания и другие объявления на карте' },
  { id: 'updates', title: 'Новые версии', hint: 'Когда на сайте появилось что-то новое' },
  { id: 'news', title: 'Сообщения колледжа', hint: 'Важное от команды сайта и колледжа' },
]
export const ALL_TOPICS = PUSH_TOPICS.map((topic) => topic.id)

// Общий вид для превью на странице и для уведомлений, показанных браузером.
export const PUSH_KINDS = {
  'lesson-start': { label: 'Начало пары', topic: 'lessons', tone: 'blue' },
  'lesson-end': { label: 'Конец пары', topic: 'lessons', tone: 'green' },
  event: { label: 'Событие', tone: 'violet', topic: 'events' },
  update: { label: 'Новая версия', tone: 'amber', topic: 'updates' },
  news: { label: 'Сообщение', tone: 'slate', topic: 'news' },
}

// Пример каждого вида — для кнопки «Показать здесь» и превью.
// Пару берём из расписания, если она есть, иначе показываем общий текст.
export function samplePush(kind, { lesson, roomLabel } = {}) {
  const where = lesson && roomLabel ? `${lesson.subject}, ${roomLabel}` : ''
  switch (kind) {
    case 'lesson-start':
      return { kind, title: where ? `Через 5 минут: ${lesson.subject}` : 'Через 5 минут: 2-я пара', body: where ? `${roomLabel}, начало в ${lesson.start}. Маршрут уже готов.` : 'Начало в 10:40. Откройте маршрут, чтобы не опоздать.', url: lesson ? `/route?to=${lesson.roomId}` : '/schedule' }
    case 'lesson-end':
      return { kind, title: lesson ? `${lesson.subject}: пара закончилась` : '2-я пара закончилась', body: 'Перемена до 12:30. Следующий кабинет — в расписании.', url: '/schedule' }
    case 'event':
      return { kind, title: 'Концерт в актовом зале', body: 'Начало в 15:00, вход свободный.', url: '/map?room=auditorium-104' }
    case 'update':
      return { kind, title: `ЛОГОС обновился: ${SITE_VERSION_LABEL}`, body: 'Посмотрите, что нового на сайте.', url: '/' }
    default:
      return { kind: 'news', title: 'Сообщение от команды сайта', body: 'Так будут выглядеть объявления, которые отправляют из панели.', url: '/' }
  }
}

export function notificationOptions(push) {
  const lesson = push.kind === 'lesson-start' && push.url?.startsWith('/route')
  return {
    body: push.body,
    icon: '/apple-touch-icon.png',
    badge: '/push-badge.png',
    tag: push.tag || push.kind,
    renotify: true,
    data: { url: push.url || '/' },
    ...(lesson ? { actions: [{ action: 'open', title: 'Маршрут' }] } : {}),
  }
}

// Где открыт сайт: от этого зависят шаги включения.
export function detectPlatform(agent = globalThis.navigator?.userAgent || '', touchPoints = globalThis.navigator?.maxTouchPoints || 0) {
  if (/iPhone|iPad|iPod/i.test(agent) || (/Macintosh/i.test(agent) && touchPoints > 1)) return 'ios'
  if (/Android/i.test(agent)) return 'android'
  return 'desktop'
}

export function isStandalone() {
  try {
    return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone)
  } catch {
    return false
  }
}

// Что умеет этот браузер прямо сейчас.
export function pushSupport() {
  const platform = detectPlatform()
  const notifications = typeof window !== 'undefined' && 'Notification' in window
  const push = notifications && 'serviceWorker' in navigator && 'PushManager' in window
  const secure = typeof window !== 'undefined' && window.isSecureContext !== false
  return {
    platform,
    secure,
    notifications,
    push,
    standalone: isStandalone(),
    // На iPhone уведомления есть только у сайта, добавленного на экран «Домой» (iOS 16.4+).
    needsInstall: platform === 'ios' && !push,
    permission: notifications ? Notification.permission : 'unsupported',
  }
}

export function readTopics() {
  try {
    const saved = JSON.parse(storageGet(PUSH_TOPICS_KEY) || 'null')
    return Array.isArray(saved) ? ALL_TOPICS.filter((topic) => saved.includes(topic)) : ALL_TOPICS
  } catch {
    return ALL_TOPICS
  }
}

export function saveTopics(topics) {
  storageSet(PUSH_TOPICS_KEY, JSON.stringify(topics))
}

export function base64UrlToBytes(value) {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

async function api(body) {
  const response = await fetch(PUSH_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || (response.status === 404 ? 'Сервер уведомлений ещё не выложен.' : `Сервер ответил ${response.status}`))
  return data
}

// Сервис-воркер есть только в собранном сайте; в режиме разработки
// регистрации нет, и уведомления показываются без него.
export async function pushRegistration() {
  if (!('serviceWorker' in navigator)) return null
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) return navigator.serviceWorker.ready
  if (!import.meta.env?.PROD) return null
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

export async function currentSubscription() {
  const registration = await pushRegistration().catch(() => null)
  return registration?.pushManager ? registration.pushManager.getSubscription() : null
}

export async function askPermission() {
  if (!('Notification' in window)) throw new Error('Этот браузер не умеет показывать уведомления.')
  if (Notification.permission === 'granted') return 'granted'
  // Старый Safari принимает только колбэк, новые браузеры возвращают Promise.
  const result = await new Promise((resolve) => {
    const promise = Notification.requestPermission(resolve)
    if (promise?.then) promise.then(resolve)
  })
  if (result === 'denied') throw new Error('Уведомления запрещены в настройках браузера. Разрешите их для сайта и попробуйте снова.')
  if (result !== 'granted') throw new Error('Разрешение не выдано. Нажмите «Разрешить», когда браузер спросит.')
  return result
}

export async function subscribePush(topics) {
  await askPermission()
  const registration = await pushRegistration()
  if (!registration?.pushManager) throw new Error('Push в этом браузере недоступен. Откройте собранный сайт по https.')
  const { publicKey } = await fetch(PUSH_API, { cache: 'no-store' }).then((response) => {
    if (!response.ok) throw new Error('Сервер уведомлений не отвечает. Попробуйте позже.')
    return response.json()
  })
  let subscription = await registration.pushManager.getSubscription()
  // Ключ сервера сменился (например, папку logos-push удалили) — подписываемся заново.
  const key = subscription?.options?.applicationServerKey
  if (subscription && key && btoa(String.fromCharCode(...new Uint8Array(key))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== publicKey) {
    await subscription.unsubscribe()
    subscription = null
  }
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) })
    } catch (error) {
      // Инкогнито, браузер без сервисов Google, заблокированный FCM и т.п.
      throw new Error(`Браузер не смог подписаться на уведомления. Выйдите из режима инкогнито или попробуйте другой браузер. (${error.message})`)
    }
  }
  await api({ action: 'subscribe', subscription: subscription.toJSON(), topics, platform: detectPlatform() })
  saveTopics(topics)
  return subscription
}

export async function unsubscribePush() {
  const subscription = await currentSubscription()
  if (!subscription) return
  await api({ action: 'unsubscribe', endpoint: subscription.endpoint }).catch(() => {})
  await subscription.unsubscribe()
}

export async function sendTestPush(kind) {
  const subscription = await currentSubscription()
  if (!subscription) throw new Error('Сначала включите уведомления.')
  return api({ action: 'test', endpoint: subscription.endpoint, kind })
}

// Показать уведомление сразу, без сервера: через сервис-воркер, а если его
// нет (режим разработки) — обычным Notification.
export async function showLocalPush(push) {
  await askPermission()
  const options = notificationOptions(push)
  const registration = await pushRegistration().catch(() => null)
  if (registration?.showNotification) return registration.showNotification(push.title, options)
  const { actions: _actions, ...plain } = options
  const notification = new Notification(push.title, plain)
  notification.onclick = () => { window.focus(); window.location.assign(push.url || '/'); notification.close() }
  return notification
}

// Копия расписания для сервис-воркера: он подставит предмет и кабинет в
// уведомление о паре. Хранится в кэше браузера и на сервер не уходит.
export async function syncScheduleForPush(lessons) {
  if (typeof caches === 'undefined') return
  const compact = lessons.map((lesson) => {
    const room = rooms.find((item) => item.id === lesson.roomId)
    return { date: lesson.date, start: lesson.start, end: lesson.end, subject: lesson.subject, roomId: lesson.roomId, room: room ? `${room.name}${room.number ? ` №${room.number}` : ''}` : '' }
  })
  try {
    const cache = await caches.open(PUSH_DATA_CACHE)
    await cache.put(PUSH_SCHEDULE_URL, new Response(JSON.stringify(compact), { headers: { 'Content-Type': 'application/json' } }))
  } catch { /* приватный режим: уведомления будут без предмета */ }
}

// Держим копию свежей: при запуске сайта и после каждой правки расписания.
// Пока уведомления не разрешены, ничего не пишем.
export function keepScheduleForPush() {
  if (typeof window === 'undefined' || !('Notification' in window) || typeof caches === 'undefined') return
  const sync = () => { if (Notification.permission === 'granted') syncScheduleForPush(readSchedule()) }
  sync()
  subscribeSchedule(sync)
}
