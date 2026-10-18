import { planDecor, planRoomBounds, roomAccess, roomOutline } from './map-geometry.js'
import { rooms } from './data.js'

// Модель 3D-сцены первого экрана: из той же геометрии, по которой рисуется
// карта, собираем стены (рёбра контуров помещений), двери и колонны лестниц.
// Модуль не знает про React — его проверяют тесты.

export const WALL_HEIGHT = 24
export const HERO_ROUTE = { from: 'entrance-1', to: 'physics-211', via: 'stairs-west' }
export const FLOOR_GAP = 150

const round = (value) => Math.round(value * 10) / 10

function boxOutline([x, y, width, height]) {
  return [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]
}

// Стена — отрезок на полу: начало, длина и угол. Общая стена двух соседних
// кабинетов встречается в обоих контурах — оставляем её один раз.
export function floorWalls(floor) {
  const outlines = [
    ...rooms.filter((room) => room.floor === floor).map((room) => roomOutline(room.id)),
    ...(planDecor[floor] || []).map((item) => boxOutline(item.box)),
  ]
  const seen = new Set()
  const walls = []
  for (const outline of outlines) {
    outline.forEach(([x1, y1], index) => {
      const [x2, y2] = outline[(index + 1) % outline.length]
      const a = `${round(x1)},${round(y1)}`
      const b = `${round(x2)},${round(y2)}`
      const key = a < b ? `${a}|${b}` : `${b}|${a}`
      const length = Math.hypot(x2 - x1, y2 - y1)
      if (seen.has(key) || length < 1) return
      seen.add(key)
      walls.push({ x: round(x1), y: round(y1), length: round(length), angle: round(Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI) })
    })
  }
  return walls
}

// Дверь ставим на ту стену своего помещения, к которой ближе всего точка
// входа из roomAccess, — и проецируем точку на эту стену.
export function floorDoors(floor, width = 11) {
  const doors = []
  for (const room of rooms.filter((item) => item.floor === floor)) {
    const access = roomAccess[room.id]
    if (!access) continue
    const [px, py] = access.door
    const outline = roomOutline(room.id)
    let best = null
    outline.forEach(([x1, y1], index) => {
      const [x2, y2] = outline[(index + 1) % outline.length]
      const dx = x2 - x1
      const dy = y2 - y1
      const length = Math.hypot(dx, dy)
      if (length < width) return
      const t = Math.max(width / 2 / length, Math.min(1 - width / 2 / length, ((px - x1) * dx + (py - y1) * dy) / (length * length)))
      const cx = x1 + dx * t
      const cy = y1 + dy * t
      const distance = Math.hypot(px - cx, py - cy)
      if (!best || distance < best.distance) best = { distance, cx, cy, ux: dx / length, uy: dy / length }
    })
    if (!best) continue
    doors.push({
      id: room.id,
      x: round(best.cx - best.ux * width / 2),
      y: round(best.cy - best.uy * width / 2),
      width,
      angle: round(Math.atan2(best.uy, best.ux) * 180 / Math.PI),
    })
  }
  return doors
}

// Колонны переходов между этажами: три лестницы и лифт, по центру помещения
// первого этажа. У центральной лестницы контур Г-образный — колонну ставим
// в сам пролёт, где нарисованы ступени.
const columnOverrides = { 'stairs-middle-1': [360, 225.6] }

export function transferColumns() {
  return rooms
    .filter((room) => room.floor === 1 && /^(stairs-|lift-)/.test(room.id))
    .map((room) => {
      const [x, y, width, height] = planRoomBounds[room.id]
      const [cx, cy] = columnOverrides[room.id] || [x + width / 2, y + height / 2]
      return { id: room.id, x: round(cx), y: round(cy), lift: room.id.startsWith('lift-') }
    })
}
