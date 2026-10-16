import { useSyncExternalStore } from 'react'
import { storageGet, storageSet } from './storage.js'
import { english } from './locales/en.js'

let language = storageGet('site-language') === 'en' ? 'en' : 'ru'
const listeners = new Set()
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }
export function useLanguage() { return useSyncExternalStore(subscribe, () => language, () => 'ru') }
export function setLanguage(next) {
  if (!['ru', 'en'].includes(next) || language === next) return
  language = next
  storageSet('site-language', next)
  if (typeof document !== 'undefined') document.documentElement.lang = next
  listeners.forEach((listener) => listener())
}
if (typeof document !== 'undefined') document.documentElement.lang = language

const phrases = Object.entries(english).sort((a, b) => b[0].length - a[0].length).map(([ru, en]) => {
  const escaped = [...ru].map((char) => '.*+?^${}()|[]\\'.includes(char) ? `\\${char}` : char).join('')
  const pattern = `${/^[А-Яа-яЁё]/.test(ru) ? '(?<![А-Яа-яЁё])' : ''}${escaped}${/[А-Яа-яЁё]$/.test(ru) ? '(?![А-Яа-яЁё])' : ''}`
  return [new RegExp(pattern, 'g'), en]
})
const cache = new Map()
export function translate(value, locale = language) {
  if (Array.isArray(value)) return value.map((item) => translate(item, locale))
  if (locale !== 'en' || typeof value !== 'string' || !/[А-Яа-яЁё]/.test(value)) return value
  const trimmed = value.trim()
  if (english[trimmed]) return value.replace(trimmed, english[trimmed])
  if (cache.has(value)) return cache.get(value)
  // Composed labels (room numbers, floor counters and route descriptions).
  let result = value
  for (const [pattern, en] of phrases) result = result.replace(pattern, () => en)
  if (cache.size > 2000) cache.clear()
  cache.set(value, result)
  return result
}
export function searchableRoom(room) {
  const text = `${room.name} ${room.number} ${room.category} ${room.aliases}`
  return `${text} ${translate(text, 'en')}`.toLocaleLowerCase()
}
