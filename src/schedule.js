import { rooms } from './data.js'
import { storageGet, storageSet } from './storage.js'

// «Моё расписание»: пары вводит сам студент, они хранятся только в браузере
// (ключ logos-schedule). По ним главная показывает следующую пару и маршрут,
// а страница маршрута — успеваете ли вы. Время звонков — BELLS: если в
// колледже оно другое, поменяйте здесь (время у пары можно задать и вручную).

export const SCHEDULE_KEY = 'logos-schedule'
export const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
export const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
export const BELLS = [
  { start: '08:30', end: '10:00' },
  { start: '10:10', end: '11:40' },
  { start: '12:10', end: '13:40' },
  { start: '13:50', end: '15:20' },
  { start: '15:30', end: '17:00' },
  { start: '17:10', end: '18:40' },
]

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const listeners = new Set()

export function toMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function validLesson(lesson) {
  return Boolean(lesson && Number.isInteger(lesson.day) && lesson.day >= 1 && lesson.day <= 6
    && TIME.test(lesson.start) && TIME.test(lesson.end) && toMinutes(lesson.end) > toMinutes(lesson.start)
    && typeof lesson.subject === 'string' && lesson.subject.trim()
    && rooms.some((room) => room.id === lesson.roomId))
}

export function sortLessons(lessons) {
  return [...lessons].sort((a, b) => a.day - b.day || toMinutes(a.start) - toMinutes(b.start))
}

export function parseSchedule(raw) {
  try {
    const value = JSON.parse(raw || '[]')
    return Array.isArray(value) ? sortLessons(value.filter(validLesson)) : []
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

// День недели 1…7 (понедельник — 1), как в расписании.
const weekday = (date) => ((date.getDay() + 6) % 7) + 1

// Ближайшая пара: идущая сейчас или следующая — сегодня или в ближайшие
// дни недели. minutes — сколько минут до начала (отрицательно, если идёт).
export function nextLesson(lessons, now = new Date()) {
  if (!lessons.length) return null
  const today = weekday(now)
  const current = now.getHours() * 60 + now.getMinutes()
  for (let offset = 0; offset < 7; offset += 1) {
    const day = ((today - 1 + offset) % 7) + 1
    const list = sortLessons(lessons.filter((lesson) => lesson.day === day))
    for (const lesson of list) {
      const start = toMinutes(lesson.start) + offset * 1440
      const end = toMinutes(lesson.end) + offset * 1440
      if (end <= current) continue
      return { lesson, minutes: start - current, ongoing: start <= current, offset }
    }
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
