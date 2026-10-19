import { rooms } from './data.js'
import { storageGet, storageSet } from './storage.js'

// «Моё расписание». Пары в колледже каждый день новые, поэтому пара
// привязана к дате, а не к дню недели. Студент добавляет их сам, хранятся
// только в браузере (ключ logos-schedule). По ним главная показывает
// следующую пару с маршрутом, а страница маршрута — успеваете ли вы.

export const SCHEDULE_KEY = 'logos-schedule'
const KEEP_DAYS = 14 // старые дни удаляются сами

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

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const listeners = new Set()

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
// в воскресенье занятий нет.
export function bellsFor(key) {
  const day = parseDateKey(key).getDay()
  if (day === 0) return { bells: [], lunch: [] }
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

export function validLesson(lesson) {
  return Boolean(lesson && typeof lesson.date === 'string' && DATE.test(lesson.date)
    && TIME.test(lesson.start) && TIME.test(lesson.end) && toMinutes(lesson.end) > toMinutes(lesson.start)
    && typeof lesson.subject === 'string' && lesson.subject.trim()
    && rooms.some((room) => room.id === lesson.roomId))
}

export function sortLessons(lessons) {
  return [...lessons].sort((a, b) => a.date.localeCompare(b.date) || toMinutes(a.start) - toMinutes(b.start))
}

export function parseSchedule(raw, today = dateKey(new Date())) {
  try {
    const value = JSON.parse(raw || '[]')
    const oldest = addDays(today, -KEEP_DAYS)
    return Array.isArray(value) ? sortLessons(value.filter(validLesson).filter((lesson) => lesson.date >= oldest)) : []
  } catch {
    return []
  }
}

export function readSchedule() {
  return parseSchedule(storageGet(SCHEDULE_KEY))
}

export function saveSchedule(lessons) {
  storageSet(SCHEDULE_KEY, JSON.stringify(sortLessons(lessons.filter(validLesson))))
  listeners.forEach((listener) => listener())
}

export function subscribeSchedule(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Ближайшая пара: идущая сейчас или следующая (сегодня или в другой день).
// minutes — сколько минут до начала (отрицательно, если уже идёт),
// offset — через сколько дней.
export function nextLesson(lessons, now = new Date()) {
  const today = dateKey(now)
  const minute = now.getHours() * 60 + now.getMinutes()
  for (const lesson of sortLessons(lessons)) {
    if (lesson.date < today) continue
    const offset = Math.round((parseDateKey(lesson.date) - parseDateKey(today)) / 86400000)
    const start = toMinutes(lesson.start) + offset * 1440
    const end = toMinutes(lesson.end) + offset * 1440
    if (end <= minute) continue
    return { lesson, minutes: start - minute, ongoing: start <= minute, offset }
  }
  return null
}

// Успеваете ли дойти: сравниваем время пути с временем до начала пары.
// Запас в 2 минуты — на лестницу, толпу и поиск двери.
export function arrivalStatus(routeSeconds, minutesLeft) {
  const walk = Math.max(1, Math.ceil(routeSeconds / 60))
  const spare = minutesLeft - walk
  if (minutesLeft < 0) return { kind: 'late', walk, spare, text: 'Пара уже идёт — заходите тихо' }
  if (spare < 0) return { kind: 'late', walk, spare, text: `Опаздываете примерно на ${-spare} мин` }
  if (spare <= 2) return { kind: 'tight', walk, spare, text: spare === 0 ? 'Впритык — выходите сейчас' : `Впритык: запас ${spare} мин` }
  return { kind: 'ok', walk, spare, text: `Успеваете, запас ${spare} мин` }
}

export function formatCountdown(minutes) {
  if (minutes <= 0) return 'идёт сейчас'
  if (minutes < 60) return `через ${minutes} мин`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `через ${hours} ч ${minutes % 60} мин`
  return `через ${Math.round(hours / 24)} дн.`
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']

export function dayLabel(key, today = dateKey(new Date())) {
  const date = parseDateKey(key)
  const name = key === today ? 'Сегодня' : key === addDays(today, 1) ? 'Завтра' : key === addDays(today, 2) ? 'Послезавтра' : WEEKDAYS[date.getDay()][0].toUpperCase() + WEEKDAYS[date.getDay()].slice(1)
  return { name, date: `${date.getDate()} ${MONTHS[date.getMonth()]}`, weekday: WEEKDAYS[date.getDay()] }
}
