export const PRIVACY_UPDATED = '19 октября 2026 г.'

// Всё, что путеводитель кладёт в localStorage. Список нужен и людям (таблица
// в политике), и тестам: новый ключ без описания здесь — повод обновить политику.
export const storedItems = [
  { key: 'logos-cookie-consent', purpose: 'Ваш ответ на вопрос о cookie', kind: 'Необходимые' },
  { key: 'site-theme', purpose: 'Светлая или тёмная тема', kind: 'Функциональные' },
  { key: 'site-language', purpose: 'Язык интерфейса', kind: 'Функциональные' },
  { key: 'map-show-labels, map-show-doors', purpose: 'Показывать ли подписи и двери на плане', kind: 'Функциональные' },
  { key: 'map-manual-point, map-gps-anchors', purpose: 'Ваша метка на плане и точки привязки GPS', kind: 'Функциональные' },
  { key: 'route-voice, route-voice-preset, route-voice-name', purpose: 'Озвучка маршрута и выбранный голос', kind: 'Функциональные' },
  { key: 'game-quiz-best, game-speed-best', purpose: 'Лучшие результаты в играх', kind: 'Функциональные' },
  { key: 'logos-welcome-hidden, logos-tour-done', purpose: 'Не показывать приветствие, обучение пройдено', kind: 'Функциональные' },
]
