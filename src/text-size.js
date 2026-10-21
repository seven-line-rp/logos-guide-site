import { storageGet, storageSet } from './storage.js'

// «Крупный текст»: весь сайт чуть увеличивается (CSS zoom у body, см.
// motion.css). Помогает тем, кому мелко на телефоне, и на проекторе.
// Значение ставится на <html data-text-size> ещё до первой отрисовки (main.jsx).

export const TEXT_SIZE_KEY = 'logos-text-size'
export const TEXT_SIZES = ['normal', 'large']

export function readTextSize() {
  const value = storageGet(TEXT_SIZE_KEY)
  return TEXT_SIZES.includes(value) ? value : 'normal'
}

export function applyTextSize(value) {
  if (typeof document === 'undefined') return
  if (value === 'large') document.documentElement.dataset.textSize = 'large'
  else delete document.documentElement.dataset.textSize
}

export function setTextSize(value) {
  const next = TEXT_SIZES.includes(value) ? value : 'normal'
  storageSet(TEXT_SIZE_KEY, next)
  applyTextSize(next)
  return next
}
