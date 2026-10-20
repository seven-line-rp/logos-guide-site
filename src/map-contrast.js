import { storageGet, storageSet } from './storage.js'

// «Контрастный план» для слабовидящих: чёрные стены, белые помещения,
// жирные подписи и толстая линия маршрута — на карте, в маршруте и в режиме
// «Иду». Включается в настройках карты (ключ map-contrast) или сам, если в
// системе выбран повышенный контраст.

export const MAP_CONTRAST_KEY = 'map-contrast'

export function readMapContrast() {
  const saved = storageGet(MAP_CONTRAST_KEY)
  if (saved === 'on' || saved === 'off') return saved === 'on'
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-contrast: more)').matches)
}

export function applyMapContrast(on = readMapContrast()) {
  if (typeof document === 'undefined') return
  if (on) document.documentElement.dataset.mapContrast = 'on'
  else delete document.documentElement.dataset.mapContrast
}

export function setMapContrast(on) {
  storageSet(MAP_CONTRAST_KEY, on ? 'on' : 'off')
  applyMapContrast(on)
}
