import { rooms } from './data.js'
import { buildRouteOptions } from './map-routing.js'
import { storageGet, storageSet } from './storage.js'

// «Где ближайший…», избранные места и недавние маршруты. Избранное и
// история живут только в браузере (ключи logos-favorites и
// logos-recent-routes, см. privacy-items.js).

export const nearbyKinds = [
  { id: 'toilet', label: 'Туалет', match: (room) => room.id.startsWith('toilet-') },
  { id: 'exit', label: 'Выход', match: (room) => room.id === 'entrance-1' },
  { id: 'stairs', label: 'Лестница', match: (room) => room.id.startsWith('stairs-') },
  { id: 'lift', label: 'Лифт', match: (room) => room.id.startsWith('lift-') },
  { id: 'medical', label: 'Медпункт', match: (room) => room.id === 'medical-post' },
  { id: 'canteen', label: 'Столовая', match: (room) => room.id === 'canteen' },
  { id: 'library', label: 'Библиотека', match: (room) => room.id === 'library-214' },
  { id: 'office', label: 'Учебная часть', match: (room) => room.id === 'academic-office' },
]

// Ближайшее место нужного вида — по времени пути, а не по прямой: лестница
// за стеной может оказаться дальше, чем кажется на плане.
export function findNearest(start, kindId, exclude = '') {
  const kind = nearbyKinds.find((item) => item.id === kindId)
  if (!kind || !start) return null
  let best = null
  for (const room of rooms.filter((item) => kind.match(item) && item.id !== exclude)) {
    const [option] = buildRouteOptions(start, room.id)
    if (!option) continue
    if (!best || option.seconds < best.seconds || (option.seconds === best.seconds && option.length < best.length)) best = { room, seconds: option.seconds, meters: option.meters, length: option.length }
  }
  return best
}

// ---------- Избранное и недавние ----------

export const FAVORITES_KEY = 'logos-favorites'
export const RECENT_KEY = 'logos-recent-routes'
export const RECENT_PLACES_KEY = 'logos-recent-places'
const MAX_FAVORITES = 12
const MAX_RECENT = 6
const MAX_RECENT_PLACES = 5
const known = (id) => rooms.some((room) => room.id === id)
const listeners = new Set()

function readList(key) {
  try {
    const value = JSON.parse(storageGet(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function writeList(key, value) {
  storageSet(key, JSON.stringify(value))
  listeners.forEach((listener) => listener())
}

export function subscribePlaces(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function readFavorites() {
  return readList(FAVORITES_KEY).filter((id) => typeof id === 'string' && known(id))
}

export function isFavorite(id) {
  return readFavorites().includes(id)
}

export function toggleFavorite(id) {
  if (!known(id)) return false
  const list = readFavorites()
  const next = list.includes(id) ? list.filter((item) => item !== id) : [id, ...list].slice(0, MAX_FAVORITES)
  writeList(FAVORITES_KEY, next)
  return next.includes(id)
}

export function readRecent() {
  return readList(RECENT_KEY).filter((item) => item && known(item.to) && (item.from === 'manual' || known(item.from)))
}

// Повтор того же маршрута поднимает его наверх, а не дублирует.
export function rememberRoute(from, to, now = Date.now()) {
  if (!to || from === to || !known(to) || !(from === 'manual' || known(from))) return
  const rest = readRecent().filter((item) => !(item.from === from && item.to === to))
  writeList(RECENT_KEY, [{ from, to, at: now }, ...rest].slice(0, MAX_RECENT))
}

export function clearRecent() {
  writeList(RECENT_KEY, [])
}

// Места, открытые из поиска: при пустом запросе окно поиска показывает их первыми.
export function readRecentPlaces() {
  return readList(RECENT_PLACES_KEY).filter((id) => typeof id === 'string' && known(id))
}

export function rememberPlace(id) {
  if (!known(id)) return
  writeList(RECENT_PLACES_KEY, [id, ...readRecentPlaces().filter((item) => item !== id)].slice(0, MAX_RECENT_PLACES))
}

export function clearRecentPlaces() {
  writeList(RECENT_PLACES_KEY, [])
}

export function roomTitle(id) {
  if (id === 'manual') return 'Ваша отметка'
  const room = rooms.find((item) => item.id === id)
  return room ? `${room.name}${room.number ? ` №${room.number}` : ''}` : id
}
