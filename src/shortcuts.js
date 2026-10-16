export function isSearchShortcut(event) {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey) return false
  const target = event.target
  if (target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return false
  return event.code === 'KeyK' || ['k', 'к', 'л'].includes(event.key?.toLowerCase())
}
