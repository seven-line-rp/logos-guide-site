// День народного единства (4 ноября): считаем, сколько дней осталось, и
// в праздничную неделю предлагаем праздничную тему тем, кто сам тему не выбирал.
import { dateKey, parseDateKey } from './schedule.js'

export const UNITY = { title: 'День народного единства', month: 11, day: 4, lead: 7 }

const DAY = 24 * 60 * 60 * 1000

// Сколько дней до 4 ноября этого года (0 — сегодня, меньше нуля — уже прошёл).
export function daysToUnity(now = new Date()) {
  const today = parseDateKey(dateKey(now))
  const target = new Date(today.getFullYear(), UNITY.month - 1, UNITY.day)
  return Math.round((target - today) / DAY)
}

// Праздничная неделя: с 28 октября по 4 ноября включительно.
export function inUnityWindow(now = new Date()) {
  const left = daysToUnity(now)
  return left >= 0 && left <= UNITY.lead
}
