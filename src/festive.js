import { useSyncExternalStore } from 'react'
import { storageGet, storageSet } from './storage.js'
import { dateKey, parseDateKey } from './schedule.js'

// Праздничное оформление: сейчас — День народного единства (4 ноября).
// Включается само за неделю до праздника и в сам день, дальше выключается.
// В меню есть переключатель; запомненный выбор сильнее даты. Для проверки
// вне праздника: любая страница с ?festive=1 включает, ?festive=0 выключает.

export const FESTIVE_KEY = 'logos-festive'
export const UNITY = { id: 'unity', title: 'День народного единства', month: 11, day: 4, lead: 7 }

const DAY = 24 * 60 * 60 * 1000

// Сколько дней до ближайшего 4 ноября (0 — сегодня); после праздника — отрицательное число не нужно, считаем на текущий год.
export function daysToUnity(now = new Date()) {
  const today = parseDateKey(dateKey(now))
  const target = new Date(today.getFullYear(), UNITY.month - 1, UNITY.day)
  return Math.round((target - today) / DAY)
}

// Окно праздника: с 28 октября по 4 ноября включительно.
export function inUnityWindow(now = new Date()) {
  const left = daysToUnity(now)
  return left >= 0 && left <= UNITY.lead
}

// pref: 'on' | 'off' | null (по дате).
export function festiveActive(now = new Date(), pref = null) {
  if (pref === 'on') return true
  if (pref === 'off') return false
  return inUnityWindow(now)
}

export function readFestivePref() {
  const value = storageGet(FESTIVE_KEY)
  return value === 'on' || value === 'off' ? value : null
}

const listeners = new Set()
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }

export function isFestive(now = new Date()) {
  return festiveActive(now, readFestivePref())
}

export function applyFestive(now = new Date()) {
  if (typeof document === 'undefined') return
  if (isFestive(now)) document.documentElement.dataset.festive = UNITY.id
  else delete document.documentElement.dataset.festive
}

export function setFestive(on) {
  storageSet(FESTIVE_KEY, on ? 'on' : 'off')
  applyFestive()
  listeners.forEach((listener) => listener())
}

// ?festive=1 / ?festive=0 в адресе — быстрый предпросмотр.
export function applyFestiveParam(search) {
  const value = new URLSearchParams(search).get('festive')
  if (value === '1' || value === '0') storageSet(FESTIVE_KEY, value === '1' ? 'on' : 'off')
}

export function useFestive() {
  return useSyncExternalStore(subscribe, () => isFestive(), () => false)
}
