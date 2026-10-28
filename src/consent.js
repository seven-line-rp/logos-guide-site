// Согласие на cookie и локальное хранилище.
// Сайт не ставит рекламных и аналитических cookie. В браузере хранятся только
// настройки, которые человек выбирает сам: тема, язык, голос, метка на карте,
// рекорды в играх, отметка о пройденном обучении. Это «функциональные»
// данные: если от них отказаться, сайт работает, но ничего не запоминает.
//
// Модуль не зависит от storage.js (иначе получился бы цикл) и работает с
// localStorage напрямую, в try/catch: в приватном режиме доступ может бросать.

export const CONSENT_KEY = 'logos-cookie-consent'
export const CONSENT_VERSION = 1
export const CONSENT_EVENT = 'logos:consent-change'
export const COOKIE_SETTINGS_EVENT = 'logos:cookie-settings'

function store() {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

export function parseConsent(raw) {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    if (!value || value.v !== CONSENT_VERSION || typeof value.functional !== 'boolean') return null
    return { functional: value.functional, at: typeof value.at === 'string' ? value.at : '' }
  } catch {
    return null
  }
}

export function readConsent(storage = store()) {
  if (!storage) return null
  try { return parseConsent(storage.getItem(CONSENT_KEY)) } catch { return null }
}

// Пока человек не ответил, настройки сохраняются: он сам нажал «тёмная тема»
// или поставил метку. После отказа запись функциональных данных выключается.
export function functionalStorageAllowed(storage = store()) {
  const consent = readConsent(storage)
  return consent ? consent.functional : true
}

// Отказ стирает уже сохранённое: на этом домене в localStorage лежат только
// данные путеводителя, поэтому оставляем лишь сам ответ про cookie.
export function clearFunctionalStorage(storage = store()) {
  if (!storage) return
  try {
    const keys = []
    for (let index = 0; index < storage.length; index += 1) keys.push(storage.key(index))
    for (const key of keys) if (key && key !== CONSENT_KEY) storage.removeItem(key)
  } catch { /* приватный режим */ }
}

export function saveConsent(functional, storage = store(), now = new Date()) {
  const value = { v: CONSENT_VERSION, functional: Boolean(functional), at: now.toISOString() }
  if (!value.functional) clearFunctionalStorage(storage)
  try { storage?.setItem(CONSENT_KEY, JSON.stringify(value)) } catch { /* приватный режим */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }))
  return value
}

export function openCookieSettings() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(COOKIE_SETTINGS_EVENT))
}

export function onCookieSettings(handler) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(COOKIE_SETTINGS_EVENT, handler)
  return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, handler)
}

export function onConsentChange(handler) {
  if (typeof window === 'undefined') return () => {}
  const listener = (event) => handler(event.detail)
  window.addEventListener(CONSENT_EVENT, listener)
  return () => window.removeEventListener(CONSENT_EVENT, listener)
}
