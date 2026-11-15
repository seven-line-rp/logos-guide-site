import { storageGet, storageSet } from './storage.js'

// Горячие клавиши поиска.
// Ctrl+K (⌘K на Mac) работает всегда, даже в поле ввода.
// «/» — одиночная клавиша, поэтому срабатывает только вне полей ввода и
// отключается в меню «Ещё» (WCAG 2.1.4: односимвольные сочетания должны
// выключаться). Раньше поиск открывался одной буквой K — это перехватывало
// набор у людей с голосовым вводом и экранной клавиатурой.

export const SHORTCUTS_KEY = 'logos-shortcuts'

export function slashShortcutEnabled() {
  return storageGet(SHORTCUTS_KEY) !== 'off'
}

export function setSlashShortcut(enabled) {
  storageSet(SHORTCUTS_KEY, enabled ? 'on' : 'off')
  return enabled
}

const isTyping = (target) => Boolean(target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"]'))

export function isSearchShortcut(event, { slash = true } = {}) {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey) return false
  const key = event.key?.toLowerCase()
  if (event.ctrlKey || event.metaKey) return event.code === 'KeyK' || ['k', 'к', 'л'].includes(key)
  if (event.shiftKey || !slash || isTyping(event.target)) return false
  return key === '/' || event.code === 'Slash'
}
