// Небольшая шина событий для обучения по сайту.
// Кнопки запуска живут в шапке, на странице документации и в меню, а
// само обучение — отдельным слоем в корне приложения, поэтому они общаются
// через событие window вместо сквозных пропсов. Модуль ничего не знает про
// React, поэтому его легко использовать из тестов.

export const TOUR_START_EVENT = 'logos:tour-start'

export function startTour() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TOUR_START_EVENT))
}

export function onTourStart(handler) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(TOUR_START_EVENT, handler)
  return () => window.removeEventListener(TOUR_START_EVENT, handler)
}
