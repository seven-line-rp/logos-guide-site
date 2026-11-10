import { holidayName } from './holidays.js'

// Звонки колледжа. По ним главная показывает, что идёт сейчас, страница
// маршрута считает «успею ли на пару», а сервер рассылает напоминания за
// 5 минут до начала (public/api/notify.php получает их копию при сборке).
// Личного расписания на сайте нет: пары у всех начинаются по одним звонкам.

// Расписание звонков на 2026–2027 учебный год (начало занятий в 9:00).
// В понедельник первым идёт РОВ («Разговоры о важном»), поэтому пары
// сдвинуты. Обед: 1 курс — после 2-й пары, 2 курс — после 3-й.
export const BELLS = {
  monday: [
    { pair: 0, label: 'РОВ', start: '09:00', end: '09:35' },
    { pair: 1, label: '1-я пара', start: '09:40', end: '11:10' },
    { pair: 2, label: '2-я пара', start: '11:20', end: '12:50' },
    { pair: 3, label: '3-я пара', start: '13:10', end: '14:40' },
    { pair: 4, label: '4-я пара', start: '15:00', end: '16:30' },
  ],
  weekday: [
    { pair: 1, label: '1-я пара', start: '09:00', end: '10:30' },
    { pair: 2, label: '2-я пара', start: '10:40', end: '12:10' },
    { pair: 3, label: '3-я пара', start: '12:30', end: '14:00' },
    { pair: 4, label: '4-я пара', start: '14:20', end: '15:50' },
  ],
}
export const LUNCH = {
  monday: [{ course: 1, start: '12:50', end: '13:10' }, { course: 2, start: '14:40', end: '15:00' }],
  weekday: [{ course: 1, start: '12:10', end: '12:30' }, { course: 2, start: '14:00', end: '14:20' }],
}

export const LESSON_NOTICE_BEFORE = 5 // за сколько минут до звонка приходит напоминание

export function toMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key, days) {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

// Звонки на дату: понедельник — свой порядок, вторник–суббота — общий,
// в воскресенье и в государственные праздники занятий нет.
export function bellsFor(key) {
  const day = parseDateKey(key).getDay()
  if (day === 0 || holidayName(key)) return { bells: [], lunch: [] }
  const kind = day === 1 ? 'monday' : 'weekday'
  return { bells: BELLS[kind], lunch: LUNCH[kind] }
}

// Что идёт по звонкам сейчас: пара, перемена или обед — для главной.
export function bellState(now = new Date()) {
  const key = dateKey(now)
  const { bells, lunch } = bellsFor(key)
  if (!bells.length) return null
  const minute = now.getHours() * 60 + now.getMinutes()
  const current = bells.find((bell) => toMinutes(bell.start) <= minute && minute < toMinutes(bell.end))
  const next = bells.find((bell) => toMinutes(bell.start) > minute)
  const meal = lunch.find((item) => toMinutes(item.start) <= minute && minute < toMinutes(item.end))
  if (current) return { kind: 'lesson', bell: current, left: toMinutes(current.end) - minute, next }
  if (meal) return { kind: 'lunch', course: meal.course, left: toMinutes(meal.end) - minute, next }
  if (next) return { kind: minute < toMinutes(bells[0].start) ? 'before' : 'break', left: toMinutes(next.start) - minute, next }
  return { kind: 'over', next: null }
}

// Ближайший звонок на пару, если до него меньше трёх часов и пара ещё не идёт:
// для «успею ли» на странице маршрута.
export function nextBell(now = new Date()) {
  const state = bellState(now)
  if (!state || !state.next || state.kind === 'lesson') return null
  const minutes = toMinutes(state.next.start) - (now.getHours() * 60 + now.getMinutes())
  return minutes < 180 ? { label: state.next.label, start: state.next.start, minutes } : null
}

// Во сколько сегодня придут напоминания о парах: «08:55», «10:35»…
export function reminderTimes(kind) {
  return BELLS[kind].map((bell) => {
    const minute = toMinutes(bell.start) - LESSON_NOTICE_BEFORE
    return { ...bell, at: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}` }
  })
}

// Успеваете ли дойти: сравниваем время пути с временем до начала пары.
// Запас в 2 минуты — на лестницу, толпу и поиск двери.
export function arrivalStatus(routeSeconds, minutesLeft) {
  const walk = Math.max(1, Math.ceil(routeSeconds / 60))
  const spare = minutesLeft - walk
  if (minutesLeft < 0) return { kind: 'late', walk, spare, text: 'Пара уже идёт. Заходите тихо' }
  if (spare < 0) return { kind: 'late', walk, spare, text: `Опаздываете примерно на ${-spare} мин` }
  if (spare <= 2) return { kind: 'tight', walk, spare, text: spare === 0 ? 'Впритык. Выходите прямо сейчас' : `Впритык: запас ${spare} мин` }
  return { kind: 'ok', walk, spare, text: `Успеваете, запас ${spare} мин` }
}

export function formatCountdown(minutes) {
  if (minutes <= 0) return 'идёт сейчас'
  if (minutes < 60) return `через ${minutes} мин`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `через ${hours} ч ${minutes % 60} мин`
  return `через ${Math.round(hours / 24)} дн.`
}
