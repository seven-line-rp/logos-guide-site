// Небольшая шина событий приложения.
// Шапка, помощник и обучение живут в разных ветках дерева компонентов, поэтому
// они общаются через события window вместо сквозных пропсов: `openAssistant()`
// из шапки открывает чат, а `startTour()` из чата запускает интерактивное
// обучение по сайту. Модуль ничего не знает про React, поэтому его легко
// использовать из тестов.

export const ASSISTANT_OPEN_EVENT = 'logos:assistant-open'
export const TOUR_START_EVENT = 'logos:tour-start'

// mode: 'widget' — плавающее окно, 'full' — помощник на всю страницу.
export function openAssistant(mode = 'widget') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ASSISTANT_OPEN_EVENT, { detail: { mode } }))
}

export function onAssistantOpen(handler) {
  if (typeof window === 'undefined') return () => {}
  const listener = (event) => handler(event.detail?.mode === 'full' ? 'full' : 'widget')
  window.addEventListener(ASSISTANT_OPEN_EVENT, listener)
  return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, listener)
}

export function startTour() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TOUR_START_EVENT))
}

export function onTourStart(handler) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(TOUR_START_EVENT, handler)
  return () => window.removeEventListener(TOUR_START_EVENT, handler)
}
