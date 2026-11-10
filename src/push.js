import { LESSON_NOTICE_BEFORE, bellsFor, dateKey, toMinutes } from './bells.js'
import { storageGet, storageRemove, storageSet } from './storage.js'
import { SITE_VERSION_LABEL } from './version.js'

// Push-уведомления (страница /notifications). Браузер
// подписывается через сервис-воркер, подписка и выбранные темы уходят в
// public/api/notify.php. О парах сервер напоминает по звонкам колледжа: за
// 5 минут до начала (в 8:55 перед парой в 9:00) и в конце пары. Настройка — deploy/push.md.

export const PUSH_API = '/api/notify.php'
export const PUSH_TOPICS_KEY = 'logos-push-topics'
export const PUSH_TOPICS = [
  { id: 'lessons', title: 'Пары', hint: 'За 5 минут до начала (в 8:55 перед первой парой) и в конце пары' },
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
export function samplePush(kind) {
  switch (kind) {
    case 'lesson-start':
      return { kind, title: 'Через 5 минут: 2-я пара', body: 'Начало в 10:40. Откройте маршрут, чтобы не опоздать.', url: '/route' }
    case 'lesson-end':
      return { kind, title: '2-я пара закончилась', body: 'Перемена до 12:30.', url: '/' }
    case 'event':
      return { kind, title: 'Концерт в актовом зале', body: 'Начало в 15:00, вход свободный.', url: '/map?room=auditorium-104' }
    case 'update':
      return { kind, title: `ЛОГОС обновился: ${SITE_VERSION_LABEL}`, body: 'Посмотрите, что нового на сайте.', url: '/' }
    default:
      return { kind: 'news', title: 'Сообщение от команды сайта', body: 'Так будут выглядеть объявления, которые отправляют из панели.', url: '/' }
  }
}

export function notificationOptions(push) {
  const lesson = push.kind === 'lesson-start'
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
    inApp: inAppBrowser(),
  }
}

// Встроенные браузеры (Telegram, ВК, Instagram, WebView) не дают включить уведомления:
// разрешение там всегда «нет». Ссылку надо открыть в Chrome или Safari.
export function inAppBrowser(agent = globalThis.navigator?.userAgent || '') {
  return /; wv\)|\bwv\b|FBAN|FBAV|Instagram|Telegram|VKAndroid|VKClient|MicroMessenger|Line\/|Snapchat|OKApp/i.test(agent)
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
    if (!response.ok) throw new Error(`Разрешение получено, но сервер уведомлений ответил ${response.status}. Проблема на стороне сайта (api/notify.php), сообщите команде.`)
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
  storageRemove(PUSH_TOPICS_KEY)
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

// При запуске сайта: напоминания из открытой вкладки, сверка подписки с
// сервером и запасной крон. Пока уведомления не разрешены, ничего не делаем.
export function keepPushAlive() {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  const sync = () => { if (Notification.permission === 'granted') scheduleLessonReminders() }
  sync()
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { sync(); resyncPush() } })
  resyncPush()
  startCronTicker()
}

// Уведомления включал этот человек: тема «Пары» выбрана при подписке.
export function lessonsWanted() {
  return storageGet(PUSH_TOPICS_KEY) !== null && readTopics().includes('lessons')
}

export const PUSH_SYNC_KEY = 'logos-push-sync'
const SYNC_EVERY = 6 * 3600 * 1000

// Сервер мог потерять подписку (папку logos-push пересоздали, браузер сменил
// адрес подписки, подписка не дошла из-за сети), а на странице всё равно
// написано «включены». Раз в 6 часов тихо напоминаем серверу о себе, а если
// подписки в браузере нет, хотя человек её включал, — подписываемся заново.
export async function resyncPush({ force = false, now = Date.now() } = {}) {
  try {
    if (!('PushManager' in window) || Notification.permission !== 'granted' || storageGet(PUSH_TOPICS_KEY) === null) return false
    if (!force && now - Number(storageGet(PUSH_SYNC_KEY) || 0) < SYNC_EVERY) return false
    const registration = await pushRegistration()
    if (!registration?.pushManager) return false
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) await api({ action: 'subscribe', subscription: subscription.toJSON(), topics: readTopics(), platform: detectPlatform() })
    else await subscribePush(readTopics())
    storageSet(PUSH_SYNC_KEY, String(now))
    return true
  } catch { return false }
}

// Какие напоминания о парах показать сегодня: за 5 минут до каждого звонка
// на пару (те же, что рассылает сервер). В воскресенье и праздники — ничего.
export function lessonReminders(now = new Date()) {
  const today = dateKey(now)
  const minute = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  return bellsFor(today).bells
    .map((bell) => {
      const start = toMinutes(bell.start)
      return {
        at: start - LESSON_NOTICE_BEFORE,
        start,
        bell,
        push: { kind: 'lesson-start', tag: `lesson-${today}-${bell.start}`, title: `Через ${LESSON_NOTICE_BEFORE} минут: ${bell.label}`, body: `Начало в ${bell.start}. Откройте маршрут, чтобы не опоздать.`, url: '/route' },
      }
    })
    .filter((item) => item.start > minute)
    .map((item) => ({ ...item, delay: Math.max(0, (item.at - minute) * 60_000) }))
}

const reminderTimers = new Set()
const FIRED_KEY = 'logos-push-fired'

// Пока сайт открыт (вкладка или приложение с экрана «Домой»), напоминание
// показывает сам браузер — даже если сервер рассылки не работает.
export function scheduleLessonReminders(now = new Date()) {
  reminderTimers.forEach((timer) => clearTimeout(timer))
  reminderTimers.clear()
  if (typeof window === 'undefined' || Notification.permission !== 'granted' || !lessonsWanted()) return []
  const plan = lessonReminders(now)
  for (const item of plan) {
    reminderTimers.add(setTimeout(() => showReminderOnce(item.push), item.delay))
  }
  return plan
}

async function showReminderOnce(push) {
  let fired = []
  try { fired = JSON.parse(storageGet(FIRED_KEY) || '[]') } catch { fired = [] }
  if (fired.includes(push.tag)) return
  storageSet(FIRED_KEY, JSON.stringify([...fired.filter((tag) => tag.includes(dateKey(new Date()))), push.tag]))
  const registration = await pushRegistration().catch(() => null)
  const existing = registration?.getNotifications ? await registration.getNotifications({ tag: push.tag }).catch(() => []) : []
  if (existing.length) return // сервер уже прислал
  await showLocalPush(push).catch(() => {})
}

// Запасной крон: пока сайт открыт в часы занятий, раз в минуту спрашиваем
// api/notify.php?tick — сервер сам разошлёт напоминания всем, если планировщик
// на хостинге не настроен (deploy/push.md).
let ticker = 0
export function startCronTicker() {
  if (ticker || typeof window === 'undefined' || !import.meta.env?.PROD) return
  const tick = () => {
    if (document.visibilityState !== 'visible') return
    const now = new Date()
    const { bells } = bellsFor(dateKey(now))
    if (!bells.length) return
    const minute = now.getHours() * 60 + now.getMinutes()
    if (minute < toMinutes(bells[0].start) - 10 || minute > toMinutes(bells.at(-1).end) + 10) return
    fetch(`${PUSH_API}?tick=1`, { cache: 'no-store' }).catch(() => {})
  }
  ticker = window.setInterval(tick, 60_000)
  tick()
}
