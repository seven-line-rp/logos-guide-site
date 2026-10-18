import { storageSet } from './storage.js'

// Интерактивное обучение по сайту — как подсказки в играх: подсветка
// элемента, короткий текст и кнопка «Далее» / «Понятно». Запускается из
// шапки (раздел «Документация»), из меню на телефоне и из приветствия.
export const TUTORIAL_STORAGE_KEY = 'logos-tour-done'

// Цвет шага: карточка, прожектор и прогресс окрашиваются в него, чтобы
// разделы сайта запоминались по цвету. Значения — ключи палитры в tour.css.
export const TOUR_TONES = ['blue', 'violet', 'amber', 'green', 'coral', 'teal', 'pink', 'indigo']

// Шаги обучения. `to` — адрес, на который нужно перейти перед шагом,
// `targets` — селекторы подсветки (берётся первый видимый; если ни один не
// найден, шаг молча пропускается, чтобы обучение не зависало).
// `icon` — имя иконки из SiteTour.jsx.
export const TOUR_STEPS = [
  {
    id: 'intro',
    to: '/',
    targets: [],
    tone: 'blue',
    icon: 'compass',
    eyebrow: 'Знакомство',
    title: 'Добро пожаловать в «ЛОГОС»',
    text: 'Покажу, как устроен путеводитель — как подсказки в игре. Девять коротких шагов, пропустить можно в любой момент.',
    action: 'Поехали',
  },
  {
    id: 'header-search',
    to: '/',
    targets: ['.search-trigger'],
    tone: 'violet',
    icon: 'search',
    eyebrow: 'Поиск',
    title: 'Найти место за пару секунд',
    text: 'Кнопка «Найти место» открывает поиск по номеру и названию кабинета. Работает и горячая клавиша K.',
    action: 'Далее',
  },
  {
    id: 'header-map',
    to: '/',
    targets: ['.header-cta', '.desktop-nav', '.mobile-map-link'],
    tone: 'teal',
    icon: 'map',
    eyebrow: 'Навигация',
    title: 'Карта всегда под рукой',
    text: 'Кнопка «Открыть карту» ведёт на план этажей, а рядом в шапке — остальные разделы сайта.',
    action: 'Далее',
  },
  {
    id: 'quick-places',
    to: '/',
    targets: ['#quick-places'],
    tone: 'amber',
    icon: 'star',
    eyebrow: 'Главная',
    title: 'Часто ищут',
    text: 'Столовая, библиотека, учебная часть и другие популярные места — в один клик, без поиска по номеру.',
    action: 'Далее',
  },
  {
    id: 'map-plan',
    to: '/map',
    targets: ['.map-plan-panel'],
    tone: 'blue',
    icon: 'layers',
    eyebrow: 'Карта',
    title: 'План этажей',
    text: 'Нажмите на помещение — появится его карточка. Двойное нажатие на лестницу переводит на другой этаж, масштаб меняется кнопками или пальцами.',
    action: 'Далее',
  },
  {
    id: 'map-detail',
    to: '/map',
    targets: ['.room-detail-panel'],
    tone: 'indigo',
    icon: 'pin',
    eyebrow: 'Кабинет',
    title: 'Карточка кабинета',
    text: 'Здесь номер, этаж и описание. Кнопка «Построить маршрут» сразу ведёт к построению пути.',
    action: 'Далее',
  },
  {
    id: 'route',
    to: '/route',
    targets: ['.route-form-panel'],
    tone: 'green',
    icon: 'route',
    eyebrow: 'Маршрут',
    title: 'Маршрут по коридорам',
    text: 'Выберите, откуда и куда идём. Сайт покажет путь по коридорам, варианты с лифтом и лестницами и озвучит шаги.',
    action: 'Далее',
  },
  {
    id: 'rooms',
    to: '/rooms',
    targets: ['.directory-search-bar'],
    tone: 'coral',
    icon: 'list',
    eyebrow: 'Справочник',
    title: 'Справочник кабинетов',
    text: 'Если номер неизвестен — ищите по названию или фильтруйте по этажу и категории места.',
    action: 'Далее',
  },
  {
    id: 'games',
    to: '/games',
    targets: ['.game-panel', '.games-heading'],
    tone: 'pink',
    icon: 'game',
    eyebrow: 'Практика',
    title: 'Игры на перемене',
    text: 'Короткий квиз на 5 вопросов поможет запомнить кабинеты и этажи. Оценок нет.',
    action: 'Далее',
  },
  {
    id: 'docs',
    to: '/games',
    targets: ['.header-docs', '.mobile-menu-toggle'],
    tone: 'violet',
    icon: 'book',
    eyebrow: 'Документация',
    title: 'Ответы — в документации',
    text: 'Подробное описание всех разделов, горячие клавиши и ответы на частые вопросы. Там же можно снова пройти это обучение.',
    action: 'Понятно',
  },
]

export function tourStepIds() {
  return TOUR_STEPS.map((step) => step.id)
}

// Факт прохождения храним в браузере: по нему приветствие понимает,
// предлагать ли обучение ещё раз.
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
