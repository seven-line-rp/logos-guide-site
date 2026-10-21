import { planDecor, planRoomBounds, roomAccess, roomOutline } from './map-geometry.js'
import { rooms } from './data.js'

// Модель 3D-сцены первого экрана: из той же геометрии, по которой рисуется
// карта, собираем стены (рёбра контуров помещений), двери и колонны лестниц.
// Модуль не знает про React — его проверяют тесты.

export const WALL_HEIGHT = 24
// Семь маршрутов, которые сцена проигрывает по кругу: разные входы, разные
// лестницы и два раза лифт. Все идут с первого этажа на второй.
export const HERO_ROUTES = [
  { from: 'entrance-1', to: 'physics-211', via: 'stairs-west' },
  { from: 'canteen', to: 'radio-lab-228', via: 'stairs-middle' },
  { from: 'auditorium-104', to: 'uav-lab-209', via: 'stairs-north' },
  { from: 'entrance-1', to: 'library-214', via: 'lift' },
  { from: 'class-139', to: 'informatics-222', via: 'stairs-middle' },
  { from: 'medical-post', to: 'meteorology-236', via: 'lift' },
  { from: 'workshop-115', to: 'chemistry-biology-202', via: 'stairs-west' },
]
export const HERO_ROUTE = HERO_ROUTES[0]
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

// ---------- Пролёт камеры по маршруту ----------
// Один цикл (t от 0 до 1): общий план корпуса → камера опускается к входу и
// летит за точкой по первому этажу → вместе с ней поднимается по лестнице →
// летит по второму этажу → отъезжает обратно на общий план над целью.
export const FLIGHT_SECONDS = 20
const PHASES = { wide: 0.07, lower: 0.12, climb: 0.43, upper: 0.53, back: 0.84 }
const WIDE = { x: 379, y: 276, zoom: 1.05, tilt: 56, yaw: -24 }
const FOLLOW = { zoom: 2.3, tilt: 62 }
const LOOK = 45
const HIDDEN_FLOOR = 0.08 // на сколько единиц вперёд и назад смотрим, чтобы повороты камеры были плавными

const clamp01 = (value) => Math.max(0, Math.min(1, value))
const ease = (value) => (value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2)
// Мягкий ход для отрезков пути: на стыках фаз скорость не падает до нуля,
// поэтому точка не «спотыкается» у лестницы и на площадке второго этажа.
const glide = (value) => {
  const k = clamp01(value)
  return mix(k, k * k * (3 - 2 * k), 0.6)
}
const mix = (a, b, k) => a + (b - a) * k
const nearestAngle = (angle, reference) => angle + 360 * Math.round((reference - angle) / 360)

function polyline(points) {
  const lengths = [0]
  for (let index = 1; index < points.length; index += 1) {
    const [x1, y1] = points[index - 1]
    const [x2, y2] = points[index]
    lengths.push(lengths[index - 1] + Math.hypot(x2 - x1, y2 - y1))
  }
  const total = lengths.at(-1)
  const at = (distance) => {
    const d = Math.max(0, Math.min(total, distance))
    let index = 1
    while (index < lengths.length - 1 && lengths[index] < d) index += 1
    const span = lengths[index] - lengths[index - 1] || 1
    const k = (d - lengths[index - 1]) / span
    const [x1, y1] = points[index - 1]
    const [x2, y2] = points[index]
    return [mix(x1, x2, k), mix(y1, y2, k)]
  }
  return { total, at }
}

// Камера смотрит «по ходу движения»: направление пути поворачиваем вверх
// экрана. Угол берём по хорде [d − LOOK, d + LOOK] и разворачиваем без
// скачков через ±180°, поэтому на поворотах коридора камера плавно доворачивает.
function yawTrack(line, startReference) {
  const samples = 64
  const values = []
  let reference = startReference
  for (let index = 0; index <= samples; index += 1) {
    const d = (line.total * index) / samples
    const [x1, y1] = line.at(d - LOOK)
    const [x2, y2] = line.at(d + LOOK)
    const heading = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
    reference = nearestAngle(-90 - heading, reference)
    values.push(reference)
  }
  return (k) => {
    const position = clamp01(k) * samples
    const index = Math.min(samples - 1, Math.floor(position))
    return mix(values[index], values[index + 1], position - index)
  }
}

// ---------- Подъём между этажами ----------
// Лестница — винтовой марш из плит между дверью лестницы на первом этаже и
// дверью на втором. Лифт — кабина в шахте: точка заходит в неё, кабина едет
// вверх, двери открываются на втором этаже.
export const STAIR_STEPS = 18
const STAIR_RADIUS = 16
const STAIR_TURNS = 1.5
const LIFT_PHASES = { enter: 0.18, ride: 0.64 }

export function stairOffset(k) {
  const angle = 2 * Math.PI * STAIR_TURNS * k
  const reach = STAIR_RADIUS * Math.sin(Math.PI * k)
  return [reach * Math.cos(angle), reach * Math.sin(angle)]
}

export function stairSteps(a, b) {
  const at = (k) => {
    const [dx, dy] = stairOffset(k)
    return [mix(a[0], b[0], k) + dx, mix(a[1], b[1], k) + dy]
  }
  return Array.from({ length: STAIR_STEPS }, (_, index) => {
    const k = (index + 0.5) / STAIR_STEPS
    const [x, y] = at(k)
    const [x1, y1] = at(Math.max(0, k - 0.02))
    const [x2, y2] = at(Math.min(1, k + 0.02))
    return { x: round(x), y: round(y), k: Math.round(k * 1000) / 1000, angle: round(Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI) }
  })
}

export function buildFlight(lowerPoints, upperPoints, gap = FLOOR_GAP, transfer = { kind: 'stairs' }) {
  const lower = polyline(lowerPoints)
  const upper = polyline(upperPoints)
  const lowerYaw = yawTrack(lower, WIDE.yaw)
  const upperYaw = yawTrack(upper, lowerYaw(1))
  const climbPoint = lowerPoints.at(-1)
  const exitPoint = upperPoints[0]
  const lift = transfer.kind === 'lift' && transfer.center
  // Положение и высота того, кто едет: по винтовой лестнице или в кабине лифта.
  const climbAt = (m) => {
    if (!lift) {
      const k = glide(m)
      const [dx, dy] = stairOffset(k)
      return { x: mix(climbPoint[0], exitPoint[0], k) + dx, y: mix(climbPoint[1], exitPoint[1], k) + dy, z: gap * k, door: 1 }
    }
    const [cx, cy] = transfer.center
    const { enter, ride } = LIFT_PHASES
    const leave = enter + ride
    if (m < enter) {
      const k = glide(m / enter)
      return { x: mix(climbPoint[0], cx, k), y: mix(climbPoint[1], cy, k), z: 0, door: 1 - k }
    }
    if (m > leave) {
      const k = glide((m - leave) / (1 - leave))
      return { x: mix(cx, exitPoint[0], k), y: mix(cy, exitPoint[1], k), z: gap, door: k }
    }
    return { x: cx, y: cy, z: gap * glide((m - enter) / ride), door: 0 }
  }
  const follow = (x, y, z, yaw) => ({ x, y, z, zoom: FOLLOW.zoom, tilt: FOLLOW.tilt, yaw })
  const blend = (a, b, k) => ({ x: mix(a.x, b.x, k), y: mix(a.y, b.y, k), z: mix(a.z, b.z, k), zoom: mix(a.zoom, b.zoom, k), tilt: mix(a.tilt, b.tilt, k), yaw: mix(a.yaw, nearestAngle(b.yaw, a.yaw), k) })
  const wide = { ...WIDE, z: gap / 2 }

  return function frameAt(time) {
    const t = ((time % 1) + 1) % 1
    // upperFloor — видимость второго этажа: пока камера летит по первому, он
    // висит прямо перед объективом, поэтому почти растворяется.
    const frame = { lower: 0, upper: 0, walker: null, beam: 0, beacon: 0.25 * clamp01(t / 0.06), upperFloor: 1, climb: { progress: 0, vis: 0, door: 1, x: climbPoint[0], y: climbPoint[1], z: 0 } }
    if (t < PHASES.lower) {
      const [x, y] = lower.at(0)
      const dive = ease(clamp01((t - PHASES.wide) / (PHASES.lower - PHASES.wide)))
      frame.camera = blend(wide, follow(x, y, 0, lowerYaw(0)), dive)
      frame.walker = { x, y, z: 0, visible: t > PHASES.wide }
      frame.upperFloor = mix(1, HIDDEN_FLOOR, dive)
    } else if (t < PHASES.climb) {
      const k = glide((t - PHASES.lower) / (PHASES.climb - PHASES.lower))
      const [x, y] = lower.at(lower.total * k)
      frame.lower = k
      frame.camera = follow(x, y, 0, lowerYaw(k))
      frame.walker = { x, y, z: 0, visible: true }
      frame.upperFloor = HIDDEN_FLOOR
      frame.climb.vis = clamp01((k - 0.8) / 0.2)
    } else if (t < PHASES.upper) {
      const m = clamp01((t - PHASES.climb) / (PHASES.upper - PHASES.climb))
      const { x, y, z, door } = climbAt(m)
      const k = z / gap
      frame.lower = 1
      frame.camera = { ...follow(x, y, z, mix(lowerYaw(1), nearestAngle(upperYaw(0), lowerYaw(1)), k)), zoom: FOLLOW.zoom - Math.sin(k * Math.PI) * 0.5 }
      frame.walker = { x, y, z, visible: true }
      frame.upperFloor = mix(HIDDEN_FLOOR, 1, k)
      frame.climb = { progress: lift ? m : k, vis: 1, door, x, y, z }
    } else if (t < PHASES.back) {
      const k = glide((t - PHASES.upper) / (PHASES.back - PHASES.upper))
      const [x, y] = upper.at(upper.total * k)
      frame.lower = 1
      frame.upper = k
      frame.climb = { progress: 1, vis: 1 - clamp01(k / 0.15), door: 1, x: exitPoint[0], y: exitPoint[1], z: gap }
      frame.camera = follow(x, y, gap, upperYaw(k))
      frame.walker = { x, y, z: gap, visible: true }
    } else {
      const k = ease(clamp01((t - PHASES.back) / (1 - PHASES.back)))
      const [x, y] = upper.at(upper.total)
      const fade = clamp01((t - 0.95) / 0.05)
      frame.lower = 1
      frame.upper = 1
      frame.climb = { progress: 1, vis: 0, door: 1, x: exitPoint[0], y: exitPoint[1], z: gap }
      frame.beacon = 1 - fade
      frame.camera = blend(follow(x, y, gap, upperYaw(1)), wide, k)
      frame.walker = { x, y, z: gap, visible: k < 0.35 }
      frame.routeOpacity = 1 - fade
    }
    if (frame.routeOpacity === undefined) frame.routeOpacity = 1
    return frame
  }
}
