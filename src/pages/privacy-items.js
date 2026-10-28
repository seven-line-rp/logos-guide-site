export const PRIVACY_UPDATED = '27 октября 2026 г.'

// Всё, что путеводитель кладёт в localStorage. Список нужен и людям (таблица
// в политике), и тестам: новый ключ без описания здесь — повод обновить политику.
export const storedItems = [
  { key: 'logos-cookie-consent', purpose: 'Ваш ответ на вопрос о cookie', kind: 'Необходимые' },
  { key: 'site-theme', purpose: 'Светлая или тёмная тема', kind: 'Функциональные' },
  { key: 'site-language', purpose: 'Язык интерфейса', kind: 'Функциональные' },
  { key: 'map-show-labels, map-show-doors, map-contrast', purpose: 'Показывать ли подписи и двери на плане, контрастный план', kind: 'Функциональные' },
  { key: 'map-manual-point, map-gps-anchors', purpose: 'Ваша метка на плане и точки привязки GPS', kind: 'Функциональные' },
  { key: 'route-voice, route-voice-preset, route-voice-name', purpose: 'Озвучка маршрута и выбранный голос', kind: 'Функциональные' },
  { key: 'game-quiz-best, game-speed-best, game-2048-best, game-snake-best', purpose: 'Лучшие результаты в играх', kind: 'Функциональные' },
  { key: 'logos-ai-chats', purpose: 'Ваши чаты с ЛОГОС AI и приложенные к ним картинки', kind: 'Функциональные' },
  { key: 'logos-favorites, logos-recent-routes, logos-recent-places', purpose: 'Избранные места, последние маршруты и места из поиска', kind: 'Функциональные' },
  { key: 'logos-text-size', purpose: 'Крупный текст на сайте', kind: 'Функциональные' },
  { key: 'logos-start-checklist', purpose: 'Отметки в чек-листе первой недели', kind: 'Функциональные' },
  { key: 'logos-schedule', purpose: 'Ваше расписание пар', kind: 'Функциональные' },
  { key: 'logos-push-topics', purpose: 'Какие уведомления присылать (пары, события, версии, сообщения)', kind: 'Функциональные' },
  { key: 'logos-here, route-need-lift', purpose: 'Где закончился последний маршрут (на 3 часа) и настройка «Мне нужен лифт»', kind: 'Функциональные' },
  { key: 'logos-tour-done', purpose: 'Обучение по сайту пройдено', kind: 'Функциональные' },
]
