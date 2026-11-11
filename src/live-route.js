import { METRES_PER_UNIT } from './map-location.js'

// Ведение по маршруту в реальном времени. Здесь только геометрия, без React:
// где человек относительно линии пути, какой шаг уже пройден и не ушёл ли он
// в сторону. Положение приходит от GPS или Bluetooth-маячков
// (src/use-live-position.js), страница маршрута листает шаги сама.

export const ARRIVE_METRES = 2.5 // ближе этого к вершине шага — шаг пройден
export const OFF_ROUTE_METRES = 10

// Длина пути от начала до каждой вершины.
export function routeLengths(points) {
  const lengths = [0]
  for (let index = 1; index < points.length; index += 1) {
    lengths.push(lengths[index - 1] + Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]))
  }
  return lengths
}

// Ближайшая к человеку точка линии маршрута: сколько уже пройдено (along),
// как далеко он от линии (offset) и где эта точка на плане. Всё в единицах плана.
export function projectOnRoute(points, [px, py]) {
  if (!Array.isArray(points) || !points.length) return null
  if (points.length === 1) return { along: 0, total: 0, offset: Math.hypot(px - points[0][0], py - points[0][1]), point: points[0], segment: 0 }
  const lengths = routeLengths(points)
  let best = null
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay] = points[index - 1]
    const [bx, by] = points[index]
    const dx = bx - ax
    const dy = by - ay
    const span = dx * dx + dy * dy
    const t = span ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / span)) : 0
    const x = ax + dx * t
    const y = ay + dy * t
    const offset = Math.hypot(px - x, py - y)
    if (!best || offset < best.offset) best = { along: lengths[index - 1] + Math.sqrt(span) * t, offset, point: [x, y], segment: index - 1 }
  }
  return { ...best, total: lengths.at(-1) }
}

// До какого шага человек уже дошёл. Смотрим только шаги после текущего на том
// же этаже и в той же части пути: назад не листаем, на другой этаж сами не
// переходим (GPS этаж не знает). Шаг пройден, когда до его вершины осталось
// меньше ARRIVE_METRES с поправкой на точность замера.
export function liveStepIndex(steps, currentIndex, points, along, { floor, accuracy = 0 } = {}) {
  const current = steps[currentIndex]
  if (!current || !points?.length) return currentIndex
  const lengths = routeLengths(points)
  const scale = METRES_PER_UNIT[floor] || 0.0833
  // Чем хуже точность, тем осторожнее: при ±15 м шаг засчитываем только у самой вершины.
  const reach = Math.max(1, ARRIVE_METRES - Math.max(0, accuracy - 5) * 0.15) / scale
  let next = currentIndex
  for (let index = currentIndex + 1; index < steps.length; index += 1) {
    const step = steps[index]
    if (step.floor !== floor || (step.leg || 0) !== (current.leg || 0)) break
    const at = lengths[Math.min(lengths.length - 1, step.progress)] ?? 0
    if (at - along > reach) break
    next = index
  }
  return next
}

// Ушёл ли человек с маршрута: дальше OFF_ROUTE_METRES от линии и заведомо
// дальше, чем может ошибаться сам замер.
export function isOffRoute(offset, floor, accuracy = 0) {
  const metres = offset * (METRES_PER_UNIT[floor] || 0.0833)
  return metres > Math.max(OFF_ROUTE_METRES, accuracy * 1.5)
}

// ---------- Ведение по шагам, когда места не знаем ----------
// GPS пропал или слабый — продолжаем по датчику шагов: от последней точной
// отметки (anchor.along) идём вперёд по линии маршрута на длину шага за каждый
// шаг. Так навигаторы едут в тоннеле по инерциальным датчикам: путь известен,
// нужно только знать, сколько пройдено.
export const STRIDE_METRES = 0.7

// Точка линии маршрута на расстоянии along от начала и номер её отрезка.
export function pointAtDistance(points, along) {
  if (!Array.isArray(points) || !points.length) return null
  const lengths = routeLengths(points)
  const d = Math.max(0, Math.min(lengths.at(-1), along))
  let index = 1
  while (index < points.length - 1 && lengths[index] < d) index += 1
  if (points.length === 1) return { point: points[0], segment: 0 }
  const span = lengths[index] - lengths[index - 1] || 1
  const k = (d - lengths[index - 1]) / span
  const [ax, ay] = points[index - 1]
  const [bx, by] = points[index]
  return { point: [ax + (bx - ax) * k, ay + (by - ay) * k], segment: index - 1 }
}

// Где человек по шагам: anchor — { along, steps } в момент последней точной
// отметки, steps — сколько шагов насчитано сейчас. Точность падает с каждым
// шагом: длина шага у всех разная.
export function sensorProgress(anchor, steps, floor, total) {
  const walked = Math.max(0, steps - anchor.steps) * STRIDE_METRES
  const scale = METRES_PER_UNIT[floor] || 0.0833
  return { along: Math.min(total, anchor.along + walked / scale), walked, accuracy: 3 + walked * 0.15 }
}
