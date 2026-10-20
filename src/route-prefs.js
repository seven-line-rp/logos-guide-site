import { useSyncExternalStore } from 'react'
import { rooms } from './data.js'
import { storageGet, storageRemove, storageSet } from './storage.js'
import { bellState } from './schedule.js'

// Настройки и состояние навигатора, которые живут между маршрутами:
// «мне нужен лифт» (ключ route-need-lift) и «я здесь» — где человек
// закончил последний маршрут (ключ logos-here). Только в этом браузере.

export const NEED_LIFT_KEY = 'route-need-lift'
export const HERE_KEY = 'logos-here'
// «Я здесь» через несколько часов уже неправда: человек ушёл домой.
export const HERE_MAX_AGE = 3 * 60 * 60 * 1000

const listeners = new Set()
const notify = () => listeners.forEach((listener) => listener())
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }

export function readNeedLift() {
  return storageGet(NEED_LIFT_KEY) === '1'
}

export function setNeedLift(on) {
  if (on) storageSet(NEED_LIFT_KEY, '1')
  else storageRemove(NEED_LIFT_KEY)
  notify()
}

export function useNeedLift() {
  return useSyncExternalStore(subscribe, readNeedLift, () => false)
}

export function parseHere(raw, now = Date.now()) {
  try {
    const value = JSON.parse(raw || 'null')
    if (!value || typeof value.roomId !== 'string' || !Number.isFinite(value.at)) return null
    if (!rooms.some((room) => room.id === value.roomId) || now - value.at > HERE_MAX_AGE || value.at > now + 60000) return null
    return value
  } catch {
    return null
  }
}

let hereCache = { raw: undefined, value: null }
export function readHere(now = Date.now()) {
  const raw = storageGet(HERE_KEY)
  if (raw !== hereCache.raw) hereCache = { raw, value: parseHere(raw, now) }
  return hereCache.value
}

export function setHere(roomId, now = Date.now()) {
  if (roomId) storageSet(HERE_KEY, JSON.stringify({ roomId, at: now }))
  else storageRemove(HERE_KEY)
  notify()
}

export function useHere() {
  return useSyncExternalStore(subscribe, readHere, () => null)
}

// ---------- Толпа на переменах ----------
// Оценка, а не измерение: на перемене и в обед на лестницах и у лифта
// людно, поэтому время перехода между этажами берём с запасом. Центральная
// лестница — между главным коридором и холлом, по ней ходят чаще всего.
const CROWD_SECONDS = { lift: 60, 'stairs-middle': 30, 'stairs-west': 15, 'stairs-north': 15 }

export function crowdMoment(now = new Date()) {
  const state = bellState(now)
  if (!state) return null
  if (state.kind === 'break' || state.kind === 'lunch') return { kind: state.kind, left: state.left }
  if (state.kind === 'before' && state.left <= 10) return { kind: 'before', left: state.left }
  return null
}

// Варианты маршрута с поправкой на толпу, снова отсортированные по времени.
export function withCrowd(options, moment) {
  if (!moment) return options
  return options.map((option) => {
    const extra = option.transfer ? CROWD_SECONDS[option.kind] || 0 : 0
    return extra ? { ...option, seconds: option.seconds + extra, crowdSeconds: extra } : option
  }).sort((first, second) => (first.seconds - second.seconds) || (first.length - second.length))
}
