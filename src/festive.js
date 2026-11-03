// День народного единства (4 ноября) для темы «Единство»: сколько дней
// осталось до праздника этого года.
import { dateKey, parseDateKey } from './schedule.js'

export const UNITY = { title: 'День народного единства', month: 11, day: 4 }

const DAY = 24 * 60 * 60 * 1000

// 0 — сегодня, больше нуля — праздник впереди, меньше нуля — уже прошёл.
export function daysToUnity(now = new Date()) {
  const today = parseDateKey(dateKey(now))
  const target = new Date(today.getFullYear(), UNITY.month - 1, UNITY.day)
  return Math.round((target - today) / DAY)
}
