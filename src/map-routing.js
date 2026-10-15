import { rooms } from './data'

// Bounds are in the same coordinate system as the two floor-plan SVG viewBoxes.
// Keeping these rectangles here also clips every interactive hit-area to the plan.
export const planRoomBounds = {
  canteen: [0, 0, 147, 155], 'workshop-115': [148, 94, 109, 62], 'simulator-114': [257, 94, 84, 62],
  'academic-office': [341, 94, 184, 62], 'lift-1': [525, 94, 24, 62], 'stairs-north-1': [549, 94, 62, 62],
  'auditorium-104': [610, 94, 147, 150], 'class-119': [0, 179, 61, 74], 'class-118': [0, 252, 61, 74],
  'toilet-men-1': [85.5, 179, 84, 32], 'toilet-women-1': [85.5, 210, 84, 32], 'language-148': [148, 179, 95, 63],
  'aerodynamics-120': [243, 179, 75, 63], 'stairs-middle-1': [318, 179, 65, 63], 'director-149': [383, 179, 67, 63],
  'changing-room': [450, 179, 99, 63], 'hall-1': [549, 179, 61, 62], 'entrance-1': [548, 241, 62, 23],
  'stairs-west-1': [0, 322, 62, 64], 'class-139': [85, 308, 63, 67], 'class-138': [85, 375, 63, 68],
  'class-162': [0, 419, 62, 49], 'training-centre-113': [0, 468, 149, 84],
  'library-214': [0, 0, 148, 155], 'radio-lab-228': [144, 94, 115, 63], 'electro-radio-230': [259, 94, 98, 63],
  'assistant-230': [357, 94, 66, 63], 'uav-lab-209': [423, 94, 112, 63], 'lift-2': [535, 94, 26, 63],
  'stairs-north-2': [561, 94, 49, 63], 'meteorology-236': [0, 182, 62, 97], 'toilet-men-2': [86, 182, 62, 32],
  'toilet-women-2': [86, 214, 62, 34], 'physics-211': [168, 182, 154, 64], 'stairs-middle-2': [322, 182, 70, 64],
  'psychologist-224': [392, 182, 33, 64], 'class-217': [425, 182, 55, 64], 'class-229': [480, 182, 31, 64],
  'informatics-222': [511, 182, 50, 64], 'stairs-west-2': [0, 331, 62, 96], 'chemistry-biology-202': [86, 245, 62, 83],
  'assistant-202': [86, 328, 62, 55], 'practical-225': [86, 383, 62, 34], 'electrical-lab-207': [0, 478, 78, 82],
  'biotech-lab-225': [78, 431, 70, 128],
}

// These are the actual walkable strips visible on the supplied plans. Routes are
// searched only inside them, rather than drawing a straight line through rooms.
const corridors = {
  1: [[0, 155, 610, 24], [62, 179, 24, 290], [548, 179, 62, 85]],
  2: [[86, 155, 524, 28], [62, 178, 24, 320]],
}
const GRID = 8
const floorGrids = new Map()

function pointInCorridor([x, y], floor) {
  const doorTolerance = 2
  return corridors[floor].some(([left, top, width, height]) => x >= left - doorTolerance && x <= left + width + doorTolerance && y >= top - doorTolerance && y <= top + height + doorTolerance)
}

function segmentInCorridors(start, end, floor) {
  const length = Math.abs(end[0] - start[0]) + Math.abs(end[1] - start[1])
  const samples = Math.max(1, Math.ceil(length / 2))
  for (let index = 0; index <= samples; index += 1) {
    const ratio = index / samples
    if (!pointInCorridor([start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio], floor)) return false
  }
  return true
}

function gridForFloor(floor) {
  if (floorGrids.has(floor)) return floorGrids.get(floor)
  const width = floor === 1 ? 758 : 767
  const height = floor === 1 ? 552 : 561
  const columns = Math.ceil((width - 4) / GRID)
  const rows = Math.ceil((height - 4) / GRID)
  const points = new Map()
  const neighbours = new Map()
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const point = [4 + column * GRID, 4 + row * GRID]
      if (pointInCorridor(point, floor)) points.set(`${column}:${row}`, point)
    }
  }
  for (const key of points.keys()) {
    const [column, row] = key.split(':').map(Number)
    neighbours.set(key, [[column - 1, row], [column + 1, row], [column, row - 1], [column, row + 1]]
      .map(([nextColumn, nextRow]) => `${nextColumn}:${nextRow}`)
      .filter((nextKey) => points.has(nextKey)))
  }
  const grid = { points, neighbours }
  floorGrids.set(floor, grid)
  return grid
}

export function isPointInCollegePlan(point, floor) {
  if (!corridors[floor]) return false
  const [x, y] = point
  const inRoom = rooms.some((room) => {
    if (room.floor !== floor || !planRoomBounds[room.id]) return false
    const [left, top, width, height] = planRoomBounds[room.id]
    return x >= left && x <= left + width && y >= top && y <= top + height
  })
  return inRoom || pointInCorridor(point, floor)
}

function roomDoor(room) {
  const [x, y, width, height] = planRoomBounds[room.id]
  const [side, position = 0.5] = room.map.door || ['top', 0.5]
  if (side === 'bottom') return [x + width * position, y + height]
  if (side === 'left') return [x, y + height * position]
  if (side === 'right') return [x + width, y + height * position]
  return [x + width * position, y]
}

function corridorEntrances(door, floor, grid) {
  return [...grid.points.entries()]
    .filter(([, point]) => Math.abs(point[0] - door[0]) + Math.abs(point[1] - door[1]) <= 40 && segmentInCorridors(door, point, floor))
    .sort((first, second) => (Math.abs(first[1][0] - door[0]) + Math.abs(first[1][1] - door[1])) - (Math.abs(second[1][0] - door[0]) + Math.abs(second[1][1] - door[1])))
    .map(([key]) => key)
}

function corridorPath(floor, startDoor, endDoor) {
  const grid = gridForFloor(floor)
  const starts = corridorEntrances(startDoor, floor, grid)
  const ends = new Set(corridorEntrances(endDoor, floor, grid))
  if (!starts.length || !ends.size) return []

  const queue = [...starts]
  const previous = new Map(starts.map((key) => [key, null]))
  let destination = null
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]
    if (ends.has(current)) { destination = current; break }
    for (const next of grid.neighbours.get(current) || []) {
      if (previous.has(next)) continue
      previous.set(next, current)
      queue.push(next)
    }
  }
  if (!destination) return []
  const keys = []
  for (let key = destination; key; key = previous.get(key)) keys.unshift(key)
  const points = keys.map((key) => grid.points.get(key))
  // Simplify collinear grid steps without changing the safe path.
  const simplified = points.filter((point, index) => {
    if (index === 0 || index === points.length - 1) return true
    const before = points[index - 1]
    const after = points[index + 1]
    return (point[0] - before[0]) * (after[1] - point[1]) !== (point[1] - before[1]) * (after[0] - point[0])
  })
  return [startDoor, ...simplified, endDoor]
}

function transferRoom(floor, transition) {
  return rooms.find((room) => room.id === (transition === 'stairs' ? `stairs-middle-${floor}` : `lift-${floor}`))
}

function roomName(room) { return `${room.name}${room.number ? ` №${room.number}` : ''}` }

export function calculateIndoorRoute(startId, targetId, floor, transition = 'lift') {
  const startRoom = rooms.find((room) => room.id === startId)
  const targetRoom = rooms.find((room) => room.id === targetId)
  if (!corridors[floor] || !startRoom || !targetRoom) return { points: [], waypoints: [] }

  const routeStart = startRoom.floor === floor ? startRoom : transferRoom(floor, transition)
  const routeEnd = targetRoom.floor === floor ? targetRoom : transferRoom(floor, transition)
  if (!routeStart || !routeEnd || !planRoomBounds[routeStart.id] || !planRoomBounds[routeEnd.id]) return { points: [], waypoints: [] }

  const points = corridorPath(floor, roomDoor(routeStart), roomDoor(routeEnd))
  return {
    points,
    waypoints: points.length > 3 ? ['По коридору'] : [],
    startLabel: roomName(routeStart),
    endLabel: roomName(routeEnd),
  }
}
