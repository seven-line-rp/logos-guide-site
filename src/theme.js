import { useSyncExternalStore } from 'react'
import { storageGet, storageSet } from './storage.js'
import { inUnityWindow } from './festive.js'

// Тема оформления: светлая, тёмная или праздничная («Единство»). Выбор лежит
// в localStorage (ключ site-theme). Пока человек сам не выбирал, в праздничную
// неделю сайт открывается в теме «Единство», в остальное время — в светлой.
// Для проверки: любая страница с ?theme=unity (или light, dark) ставит тему.

export const THEMES = ['light', 'dark', 'unity']
export const THEME_KEY = 'site-theme'
const META_COLORS = { light: '#2f5fe8', dark: '#11131b', unity: '#1c57a5' }

export function resolveTheme(stored, now = new Date()) {
  if (THEMES.includes(stored)) return stored
  return inUnityWindow(now) ? 'unity' : 'light'
}

let current = 'light'
const listeners = new Set()
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }

export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme] || META_COLORS.light)
}

// Вызывается один раз до первой отрисовки (main.jsx).
export function initTheme(search = '', now = new Date()) {
  const asked = new URLSearchParams(search).get('theme')
  if (THEMES.includes(asked)) storageSet(THEME_KEY, asked)
  current = resolveTheme(THEMES.includes(asked) ? asked : storageGet(THEME_KEY), now)
  applyTheme(current)
}

export function getTheme() { return current }

export function setTheme(next) {
  if (!THEMES.includes(next) || next === current) return
  current = next
  storageSet(THEME_KEY, next)
  applyTheme(next)
  listeners.forEach((listener) => listener())
}

export function nextTheme(theme) {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]
}

export function useTheme() {
  return useSyncExternalStore(subscribe, getTheme, () => 'light')
}
