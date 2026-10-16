import { rooms } from './data.js'
import { circulation, isManualPoint, pointInPolygon, roomAccess, roomAtPoint } from './map-geometry.js'

export { planRoomBounds } from './map-geometry.js'

const emptyRoute = { points: [], waypoints: [], guides: [], length: 0 }

// Метрики маршрута. Масштаб плана снят с коридора: его ширина 24.5 единицы
// при реальных ~2.5 м. Скорость — спокойная походка, плюс накладные расходы
// на ожидание лифта или подъём по лестнице.
export const UNITS_PER_METER = 9.8
export const WALKING_METERS_PER_SECOND = 1.25
export const STRIDE_METERS = 0.7
export const TRANSFER_SECONDS = { lift: 45, stairs: 30 }

export function routeMetrics(lengthUnits, transferKind = null) {
  const meters = lengthUnits / UNITS_PER_METER
  const overhead = transferKind ? TRANSFER_SECONDS[transferKind === 'lift' ? 'lift' : 'stairs'] : 0
  const seconds = meters / WALKING_METERS_PER_SECOND + overhead
  return { meters, seconds, footsteps: Math.round(meters / STRIDE_METERS) }
}

const TRANSFER_LABELS = {
  lift: 'Через лифт',
  'stairs-west': 'По лестнице западного крыла',
  'stairs-middle': 'По центральной лестнице',
  'stairs-north': 'По северной лестнице',
}
const TRANSFER_SHORT = {
  lift: 'лифт',
  'stairs-west': 'лестница западного крыла',
  'stairs-middle': 'центральная лестница',
  'stairs-north': 'северная лестница',
}
const TRANSFER_TOWARD = {
  lift: 'лифта',
  'stairs-west': 'лестницы западного крыла',
  'stairs-middle': 'центральной лестницы',
  'stairs-north': 'северной лестницы',
}
const TRANSFER_METHOD = {
  lift: 'на лифте',
  'stairs-west': 'по лестнице западного крыла',
  'stairs-middle': 'по центральной лестнице',
  'stairs-north': 'по северной лестнице',
}

function transferInfo(key, from, to) {
  return {
    kind: key,
    startFloor: from,
    endFloor: to,
    startId: `${key}-${from}`,
    endId: `${key}-${to}`,
    label: TRANSFER_SHORT[key] || key,
    toward: TRANSFER_TOWARD[key] || 'лестницы',
    method: TRANSFER_METHOD[key] || 'по лестнице',
  }
}

function samePoint(a, b) { return a[0] === b[0] && a[1] === b[1] }

function cleanPath(points) {
  const withoutDuplicates = points.filter((point, index) => index === 0 || !samePoint(point, points[index - 1]))
  return withoutDuplicates.filter((point, index) => {
    if (index === 0 || index === withoutDuplicates.length - 1) return true
    const prev = withoutDuplicates[index - 1]
    const next = withoutDuplicates[index + 1]
    return (point[0] - prev[0]) * (next[1] - point[1]) !== (point[1] - prev[1]) * (next[0] - point[0])
  })
}

function distance(points) {
  return points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - points[index][0], point[1] - points[index][1]), 0)
}

function name(room) { return `${room.name}${room.number ? ` №${room.number}` : ''}` }

function endpoint(value) {
  const room = typeof value === 'string' ? rooms.find((item) => item.id === value) :
    isManualPoint(value, rooms) ? roomAtPoint(value.floor, [value.x, value.y], rooms) : null
  if (typeof value === 'string' && !room) return null
  if (typeof value !== 'string' && !isManualPoint(value, rooms)) return null

  if (!room) {
    // A manually selected point in an actual corridor, not inside a room.
    const [x, y] = [value.x, value.y]
    const inMain = y >= 156 && y <= (value.floor === 1 ? 179 : 182) && x <= 610
    const inWest = x >= 62 && x <= 86 && y >= 179
    const inHall = value.floor === 1 && circulation[1][2] && pointInPolygon([x, y], circulation[1][2])
    const anchor = inMain ? [x, 168] : inWest ? [73, y] : inHall ? [579, 168] : [73, 168]
    const path = inMain ? [[x, y], anchor] : inWest ? [[x, y], anchor] :
      inHall ? [[x, y], [579, y], anchor] : [[x, y], [73, y], anchor]
    return { floor: value.floor, anchor, branch: inWest ? 'west' : 'main', path: cleanPath(path), label: 'Метка на плане' }
  }

  const access = roomAccess[room.id]
  if (!access) return null
  const { door, branch } = access
  const anchor = branch === 'west' ? [73, door[1]] : branch === 'hall' || branch === 'auditorium' ? [579, 168] :
    branch === 'library' ? [73, 168] : [door[0], 168]
  let path = branch === 'library' ? [door, [116, 126], [73, 126], anchor] :
    branch === 'auditorium' ? [door, [579, door[1]], anchor] : [door, anchor]

  if (typeof value !== 'string') {
    const from = [value.x, value.y]
    // Stay inside the selected room until its one known doorway. In particular,
    // a point in the lower west wing must not jump across the corridor.
    const via = branch === 'west' ? [door[0], from[1]] : [from[0], door[1]]
    path = [from, via, ...path]
  }
  return { floor: room.floor, anchor, branch: branch === 'west' ? 'west' : 'main', path: cleanPath(path), label: typeof value === 'string' ? name(room) : 'Метка на плане' }
}

function walk(from, to) {
  if (!from || !to || from.floor !== to.floor) return emptyRoute
  const junction = [73, 168]
  const middle = from.branch !== to.branch ? [junction] : []
  const points = cleanPath([...from.path, ...middle, ...[...to.path].reverse()])
  const waypoints = []
  if (from.branch === 'west' || to.branch === 'west') waypoints.push('Коридор западного крыла')
  if (points.some((point, index) => index > 0 && point[1] === 168 && points[index - 1][1] === 168 && Math.abs(point[0] - points[index - 1][0]) > 30)) waypoints.push('Главный коридор')
  return { points, waypoints, guides: buildGuides(points, from.floor), length: distance(points), startLabel: from.label, endLabel: to.label }
}

// Куда ведёт восточный конец главного коридора — на каждом этаже своё.
const EAST_LANDMARK = {
  1: { title: 'к холлу и актовому залу', say: 'в сторону холла' },
  2: { title: 'к лабораториям', say: 'в сторону лабораторий' },
}
const WEST_LANDMARK = {
  1: { title: 'к западному крылу', say: 'в сторону западного крыла' },
  2: { title: 'к библиотеке', say: 'в сторону библиотеки' },
}

// Подсказки «что делать дальше» с привязкой к вершине маршрута: страница
// маршрута двигает по ним точку на плане, поэтому index — позиция в points.
function buildGuides(points, floor = 1) {
  const guides = []
  const push = (guide) => {
    const previous = guides.at(-1)
    if (previous && previous.index === guide.index) guides[guides.length - 1] = guide
    else guides.push(guide)
  }
  for (let index = 1; index < points.length; index += 1) {
    const [x0, y0] = points[index - 1]
    const [x1, y1] = points[index]
    // Точка-поводырь встаёт в НАЧАЛО участка: это место, где пользователь
    // слушает подсказку, и пройденная часть линии доходит ровно до него.
    // У первого участка начало совпадает со стартом — тогда точка сдвигается
    // на шаг вперёд, иначе подсказка не отличалась бы от шага «Начало».
    const at = Math.max(1, index - 1)
    if (y0 === y1 && y0 === 168 && x0 !== x1) {
      const east = x1 > x0
      const landmark = east ? (EAST_LANDMARK[floor] || EAST_LANDMARK[1]) : (WEST_LANDMARK[floor] || WEST_LANDMARK[1])
      push({
        index: at,
        kind: 'main-corridor',
        title: `Главный коридор · ${landmark.title}`,
        detail: east ? 'Двери кабинетов по правой стороне' : 'Двери кабинетов по левой стороне',
        say: `Идите по главному коридору ${landmark.say}, до нужной двери.`,
        voiceKey: `corridor-${floor}-${east ? 'east' : 'west'}`,
      })
    } else if (x0 === x1 && y0 === y1) {
      continue
    } else if (x0 === x1 && Math.abs(y1 - y0) > 24) {
      if (x0 === 73) {
        push({
          index: at,
          kind: 'west-corridor',
          title: 'Коридор западного крыла',
          detail: 'Кабинеты по левой стороне',
          say: 'Поверните в коридор западного крыла и идите вдоль кабинетов.',
          voiceKey: 'west-corridor',
        })
      } else if (x0 === 579) {
        push({
          index: at,
          kind: 'hall',
          title: 'Холл у входа',
          detail: 'Идите к актовому залу',
          say: 'Пройдите через холл в сторону актового зала.',
          voiceKey: 'hall',
        })
      }
    }
  }
  return guides
}

export function buildIndoorRoute(start, targetId, transition = 'lift') {
  return pickRoute(buildRouteOptions(start, targetId), transition)
}

// Все разумные варианты маршрута, как в навигаторе: на одном этаже вариант
// один, между этажами — лифт и каждая из трёх лестниц. Варианты отсортированы
// по времени (расстояние + ожидание лифта или подъём), быстрый всегда первый.
export function buildRouteOptions(start, targetId) {
  const from = endpoint(start)
  const target = endpoint(targetId)
  if (!from || !target) return []

  if (from.floor === target.floor) {
    const startRoom = typeof start === 'string' ? start : roomAtPoint(start.floor, [start.x, start.y], rooms)
    if (startRoom?.id === targetId) {
      const point = typeof start === 'string' ? roomAccess[targetId].door : [start.x, start.y]
      return [{
        kind: 'same',
        label: 'Вы уже на месте',
        byFloor: { [from.floor]: { ...emptyRoute, points: [point], startLabel: from.label, endLabel: target.label } },
        transfer: null,
        length: 0,
        meters: 0,
        seconds: 0,
        footsteps: 0,
      }]
    }
    const leg = walk(from, target)
    return [{
      kind: 'same',
      label: 'Путь по этажу',
      byFloor: { [from.floor]: leg },
      transfer: null,
      length: leg.length,
      ...routeMetrics(leg.length),
    }]
  }

  const candidates = ['lift', 'stairs-west', 'stairs-middle', 'stairs-north'].map((key) => {
    const departure = endpoint(`${key}-${from.floor}`)
    const arrival = endpoint(`${key}-${target.floor}`)
    if (!departure || !arrival) return null
    const firstLeg = walk(from, departure)
    const secondLeg = walk(arrival, target)
    const length = firstLeg.length + secondLeg.length
    return {
      kind: key,
      label: TRANSFER_LABELS[key] || key,
      byFloor: { [from.floor]: firstLeg, [target.floor]: secondLeg },
      transfer: transferInfo(key, from.floor, target.floor),
      length,
      ...routeMetrics(length, key),
    }
  }).filter(Boolean)
  return candidates.sort((first, second) => (first.seconds - second.seconds) || (first.length - second.length))
}

// Выбор конкретного варианта: 'lift' — только лифт, 'stairs' — ближайшая
// лестница, остальное — точный вид перехода ('stairs-west' и т.д.).
export function pickRoute(options, preference = 'lift') {
  if (!options.length) return { byFloor: {}, transfer: null, length: 0 }
  if (preference === 'stairs') {
    const stairs = options.filter((option) => option.kind !== 'lift')
    if (stairs.length) return [...stairs].sort((first, second) => first.length - second.length)[0]
  }
  const exact = options.find((option) => option.kind === preference)
  if (exact) return exact
  if (preference === 'lift') {
    const lift = options.find((option) => option.kind === 'lift')
    if (lift) return lift
  }
  return options[0]
}

// Called by both the full-size plan and route previews, so the same stairwell
// and the same wall-aware path are displayed on both floors.
export function calculateIndoorRoute(start, targetId, floor, transition = 'lift') {
  return buildIndoorRoute(start, targetId, transition).byFloor[floor] || emptyRoute
}
