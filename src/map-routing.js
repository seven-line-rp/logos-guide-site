import { rooms } from './data.js'
import { circulation, isManualPoint, pointInPolygon, roomAccess, roomAtPoint } from './map-geometry.js'

export { planRoomBounds } from './map-geometry.js'

const emptyRoute = { points: [], waypoints: [], guides: [], length: 0 }
const transfers = { lift: ['lift'], stairs: ['stairs-west', 'stairs-middle', 'stairs-north'] }

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
  const from = endpoint(start)
  const target = endpoint(targetId)
  if (!from || !target) return { byFloor: {}, transfer: null, length: 0 }
  if (from.floor === target.floor) {
    const startRoom = typeof start === 'string' ? start : roomAtPoint(start.floor, [start.x, start.y], rooms)
    if (startRoom?.id === targetId) {
      const point = typeof start === 'string' ? roomAccess[targetId].door : [start.x, start.y]
      return { byFloor: { [from.floor]: { ...emptyRoute, points: [point], startLabel: from.label, endLabel: target.label } }, transfer: null, length: 0 }
    }
    const leg = walk(from, target)
    return { byFloor: { [from.floor]: leg }, transfer: null, length: leg.length }
  }

  const candidates = (transfers[transition] || transfers.lift).map((key) => {
    const departure = endpoint(`${key}-${from.floor}`)
    const arrival = endpoint(`${key}-${target.floor}`)
    if (!departure || !arrival) return null
    const firstLeg = walk(from, departure)
    const secondLeg = walk(arrival, target)
    return {
      byFloor: { [from.floor]: firstLeg, [target.floor]: secondLeg },
      transfer: { kind: key, startFloor: from.floor, endFloor: target.floor, startId: `${key}-${from.floor}`, endId: `${key}-${target.floor}`, label: transition === 'lift' ? 'лифт' : 'лестница', toward: transition === 'lift' ? 'лифта' : 'лестницы', method: transition === 'lift' ? 'на лифте' : 'по лестнице' },
      length: firstLeg.length + secondLeg.length,
    }
  }).filter(Boolean)
  return candidates.sort((first, second) => first.length - second.length)[0] || { byFloor: {}, transfer: null, length: 0 }
}

// Called by both the full-size plan and route previews, so the same stairwell
// and the same wall-aware path are displayed on both floors.
export function calculateIndoorRoute(start, targetId, floor, transition = 'lift') {
  return buildIndoorRoute(start, targetId, transition).byFloor[floor] || emptyRoute
}
