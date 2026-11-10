import { useSyncExternalStore } from 'react'
import { rooms } from './data.js'
import { storageGet, storageSet } from './storage.js'
import { THEMES, cleanEnabledThemes, setEnabledThemes } from './theme.js'

// Настройки сайта, которые команда меняет в панели /admin/settings без
// пересборки: какие темы доступны всем и где висят Bluetooth-маячки.
// Лежат на сервере (public/api/settings.php). Копия последнего ответа хранится
// в браузере (ключ logos-site-settings): по ней тема встаёт сразу при
// загрузке, и маячки известны без сети.

export const SETTINGS_API = '/api/settings.php'
export const SETTINGS_KEY = 'logos-site-settings'
export const BEACONS_MAX = 60
export const DEFAULT_SETTINGS = { themes: THEMES, beacons: [] }

// Маячок: имя, которое он передаёт в эфир (или «uuid:major:minor» для
// iBeacon), помещение, у которого он висит, и мощность на расстоянии 1 м.
export function cleanBeacon(value) {
  if (!value || typeof value !== 'object') return null
  const id = typeof value.id === 'string' ? value.id.trim().slice(0, 80) : ''
  const room = rooms.find((item) => item.id === value.roomId)
  if (!id || !room) return null
  const tx = Number(value.tx)
  return { id, roomId: room.id, tx: Number.isFinite(tx) && tx <= -20 && tx >= -100 ? Math.round(tx) : -59 }
}

export function cleanSettings(value) {
  const source = value && typeof value === 'object' ? value : {}
  const beacons = []
  for (const item of Array.isArray(source.beacons) ? source.beacons : []) {
    const beacon = cleanBeacon(item)
    if (beacon && !beacons.some((other) => other.id.toLowerCase() === beacon.id.toLowerCase())) beacons.push(beacon)
    if (beacons.length >= BEACONS_MAX) break
  }
  return { themes: cleanEnabledThemes(source.themes), beacons }
}

export function readCachedSettings() {
  try { return cleanSettings(JSON.parse(storageGet(SETTINGS_KEY) || 'null')) } catch { return DEFAULT_SETTINGS }
}

let current = DEFAULT_SETTINGS
const listeners = new Set()
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }

export function getSiteSettings() { return current }

export function applySiteSettings(value, { remember = true } = {}) {
  current = cleanSettings(value)
  setEnabledThemes(current.themes)
  if (remember) storageSet(SETTINGS_KEY, JSON.stringify(current))
  listeners.forEach((listener) => listener())
  return current
}

// При запуске: сначала копия из браузера, потом свежий ответ сервера.
// Без PHP или без сети остаются все темы и пустой список маячков.
export function initSiteSettings(fetchImpl = typeof fetch === 'undefined' ? null : fetch) {
  current = readCachedSettings()
  if (!fetchImpl) return Promise.resolve(current)
  return fetchImpl(SETTINGS_API, { cache: 'no-cache' })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
    .then((value) => applySiteSettings(value))
    .catch(() => current)
}

export function useSiteSettings() {
  return useSyncExternalStore(subscribe, getSiteSettings, () => DEFAULT_SETTINGS)
}
