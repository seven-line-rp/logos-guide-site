import { useSyncExternalStore } from 'react'
import { storageGet, storageSet } from './storage.js'

// Тема оформления: светлая, тёмная (src/dark-theme.css) или «Пикми» (розовая,
// с цветами, src/pickme.css). Выбор лежит в localStorage (ключ site-theme).
// Пока человек не выбирал, сайт светлый.
// Тёмную и «Пикми» можно выключить для всех в панели /admin/settings
// (src/site-settings.js): выключенная тема пропадает из меню, а у тех, кто её
// выбрал, сайт становится светлым. Светлая есть всегда.
// Для проверки: любая страница с ?theme=dark (или light, pickme) ставит тему.

export const THEMES = ['light', 'dark', 'pickme', 'v2']
export const THEME_KEY = 'site-theme'
const META_COLORS = { light: '#2f5fe8', v2: '#141518', dark: '#17181b', pickme: '#ffd9e8' }

// Список включённых тем из того, что прислал сервер: только известные,
// в обычном порядке, светлая всегда на месте.
export function cleanEnabledThemes(list) {
  if (!Array.isArray(list)) return THEMES
  return THEMES.filter((theme) => theme === 'light' || list.includes(theme))
}

export function resolveTheme(stored, enabled = THEMES) {
  return THEMES.includes(stored) && enabled.includes(stored) ? stored : 'light'
}

// Кнопка в шапке перебирает включённые темы по кругу: светлая → тёмная → «Пикми».
export function nextTheme(theme, enabled = THEMES) {
  return enabled[(enabled.indexOf(theme) + 1) % enabled.length] || 'light'
}

let current = 'light'
let chosen = 'light' // что выбрал человек; current может отличаться, пока тема выключена
let enabled = THEMES
const listeners = new Set()
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }
const emit = () => listeners.forEach((listener) => listener())

export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme === 'v2' ? 'dark' : theme
  document.documentElement.dataset.edition = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme] || META_COLORS.light)
}

// Вызывается один раз до первой отрисовки (main.jsx).
export function initTheme(search = '', enabledThemes = THEMES) {
  const asked = new URLSearchParams(search).get('theme')
  if (THEMES.includes(asked)) storageSet(THEME_KEY, asked)
  enabled = cleanEnabledThemes(enabledThemes)
  chosen = THEMES.includes(asked) ? asked : storageGet(THEME_KEY) || 'light'
  current = resolveTheme(chosen, enabled)
  applyTheme(current)
}

export function getTheme() { return current }
export function getEnabledThemes() { return enabled }

export function setTheme(next) {
  if (!enabled.includes(next) || next === current) return
  current = next
  chosen = next
  storageSet(THEME_KEY, next)
  applyTheme(next)
  emit()
}

// Сервер прислал, какие темы включены. Выбор человека не стираем: если тему
// включат обратно, она вернётся сама.
export function setEnabledThemes(list) {
  const next = cleanEnabledThemes(list)
  if (next.join() === enabled.join()) return
  enabled = next
  const theme = resolveTheme(chosen, enabled)
  if (theme !== current) { current = theme; applyTheme(theme) }
  emit()
}

export function useTheme() {
  return useSyncExternalStore(subscribe, getTheme, () => 'light')
}

export function useEnabledThemes() {
  return useSyncExternalStore(subscribe, getEnabledThemes, () => THEMES)
}
