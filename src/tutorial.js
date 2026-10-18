import { storageSet } from './storage.js'

// Команда-ключ ИИ-помощника: слово «Туторил» в чате запускает интерактивное
// обучение по сайту — как подсказки в играх: подсветка элемента, короткий
// текст и кнопка «Далее» / «Понятно».
export const TUTORIAL_COMMAND = 'Туторил'
export const TUTORIAL_STORAGE_KEY = 'logos-tour-done'

// Принимаем команду в любом регистре, со знаками препинания, в английской
// раскладке и в виде синонимов — человек не должен вспоминать точное написание.
const COMMAND_PHRASES = [
  'туторил',
  'туторила',
  'туториал',
  'туториалы',
  'tutorial',
  'обучение',
  'пройти обучение',
  'как пользоваться сайтом',
  'как работает сайт',
  'покажи как работает сайт',
  'покажи как пользоваться сайтом',
  'покажи сайт',
  'экскурсия по сайту',
  'nenjhbd', // «Туторил», набранное в английской раскладке
]

export function normalizeCommand(value) {
  if (typeof value !== 'string') return ''
  return value
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isTutorialCommand(value) {
  const text = normalizeCommand(value)
  if (!text) return false
  return COMMAND_PHRASES.some((phrase) => text === phrase)
}

// Шаги обучения. `to` — адрес, на который нужно перейти перед шагом,
// `targets` — селекторы подсветки (берётся первый найденный; если ни один не
// найден, шаг молча пропускается, чтобы обучение не зависало).
export const TOUR_STEPS = [
  {
    id: 'intro',
    to: '/',
    targets: [],
    eyebrow: 'Обучение',
    title: 'Привет! Я LOGOS AI',
    text: 'Покажу, как устроен путеводитель — как подсказки в игре. Шагов немного, пропустить можно в любой момент.',
    action: 'Поехали',
  },
  {
    id: 'header-search',
    to: '/',
    targets: ['.search-trigger'],
    eyebrow: 'Шаг 1 · Поиск',
    title: 'Найти место за пару секунд',
    text: 'Кнопка «Найти место» открывает поиск по номеру и названию кабинета. Работает и горячая клавиша K.',
    action: 'Далее',
  },
  {
    id: 'header-map',
    to: '/',
    targets: ['.header-cta', '.desktop-nav'],
    eyebrow: 'Шаг 2 · Навигация',
    title: 'Карта всегда под рукой',
    text: 'Кнопка «Открыть карту» ведёт на план этажей, а рядом в шапке — остальные разделы сайта.',
    action: 'Далее',
  },
  {
    id: 'quick-places',
    to: '/',
    targets: ['#quick-places'],
    eyebrow: 'Шаг 3 · Главная',
    title: 'Часто ищут',
    text: 'Столовая, библиотека, учебная часть и другие популярные места — в один клик, без поиска по номеру.',
    action: 'Далее',
  },
  {
    id: 'map-plan',
    to: '/map',
    targets: ['.map-plan-panel'],
    eyebrow: 'Шаг 4 · Карта',
    title: 'План этажей',
    text: 'Нажмите на помещение — справа появится его карточка. По лестнице можно перейти на другой этаж, а масштаб меняется кнопками или пальцами.',
    action: 'Далее',
  },
  {
    id: 'map-detail',
    to: '/map',
    targets: ['.room-detail-panel'],
    eyebrow: 'Шаг 5 · Кабинет',
    title: 'Карточка кабинета',
    text: 'Здесь номер, этаж и описание. Кнопка «Построить маршрут» сразу ведёт к построению пути.',
    action: 'Далее',
  },
  {
    id: 'route',
    to: '/route',
    targets: ['.route-form-panel'],
    eyebrow: 'Шаг 6 · Маршрут',
    title: 'Маршрут по коридорам',
    text: 'Выберите, откуда и куда идём. Сайт покажет путь по коридорам, варианты с лифтом и лестницами и озвучит шаги.',
    action: 'Далее',
  },
  {
    id: 'rooms',
    to: '/rooms',
    targets: ['.directory-search-bar'],
    eyebrow: 'Шаг 7 · Справочник',
    title: 'Справочник кабинетов',
    text: 'Если номер неизвестен — ищите по названию или фильтруйте по этажу и категории места.',
    action: 'Далее',
  },
  {
    id: 'games',
    to: '/games',
    targets: ['.game-panel', '.games-heading'],
    eyebrow: 'Шаг 8 · Практика',
    title: 'Игры на перемене',
    text: 'Короткий квиз на 5 вопросов поможет запомнить кабинеты и этажи. Оценок нет.',
    action: 'Далее',
  },
  {
    id: 'assistant',
    to: '/games',
    targets: ['.assistant-launcher', '.header-assistant'],
    eyebrow: 'Шаг 9 · Помощник',
    title: 'Я всегда рядом',
    text: 'Спросите меня о кабинетах и маршрутах или напишите команду «Туторил», чтобы пройти обучение ещё раз.',
    action: 'Понятно',
  },
]

export function tourStepIds() {
  return TOUR_STEPS.map((step) => step.id)
}

// Факт прохождения храним в браузере: по нему помощник понимает, показывать ли
// подсказку про обучение в приветственном экране.
export function markTutorialDone() {
  storageSet(TUTORIAL_STORAGE_KEY, new Date().toISOString())
}

export function readTutorialDone(storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null)
  if (!store) return false
  try {
    return Boolean(store.getItem(TUTORIAL_STORAGE_KEY))
  } catch {
    return false
  }
}
