import { rooms } from './data'

export const planRoomBounds = {
  canteen: [0, 0, 147, 155],
  'workshop-115': [148, 94, 109, 62],
  'simulator-114': [257, 94, 84, 62],
  'academic-office': [341, 94, 184, 62],
  'lift-1': [525, 94, 24, 62],
  'stairs-north-1': [549, 94, 62, 62],
  'auditorium-104': [610, 94, 147, 150],
  'class-119': [0, 179, 61, 74],
  'class-118': [0, 252, 61, 74],
  'toilet-men-1': [85.5, 179, 84, 32],
  'toilet-women-1': [85.5, 210, 84, 32],
  'language-148': [148, 179, 95, 63],
  'aerodynamics-120': [243, 179, 75, 63],
  'stairs-middle-1': [318, 179, 65, 63],
  'director-149': [383, 179, 67, 63],
  'changing-room': [450, 179, 99, 63],
  'hall-1': [549, 179, 61, 62],
  'entrance-1': [548, 241, 62, 23],
  'stairs-west-1': [0, 322, 62, 64],
  'class-139': [85, 308, 63, 67],
  'class-138': [85, 375, 63, 68],
  'class-162': [0, 419, 62, 49],
  'training-centre-113': [0, 468, 149, 84],
  'library-214': [0, 0, 144, 114],
  'radio-lab-228': [144, 94, 115, 63],
  'electro-radio-230': [259, 94, 98, 63],
  'assistant-230': [357, 94, 66, 63],
  'uav-lab-209': [423, 94, 112, 63],
  'lift-2': [535, 94, 26, 63],
  'stairs-north-2': [561, 94, 49, 63],
  'meteorology-236': [0, 182, 62, 97],
  'toilet-men-2': [86, 182, 62, 32],
  'toilet-women-2': [86, 214, 62, 34],
  'physics-211': [168, 182, 154, 64],
  'stairs-middle-2': [322, 182, 70, 64],
  'psychologist-224': [392, 182, 33, 64],
  'class-217': [425, 182, 55, 64],
  'class-229': [480, 182, 31, 64],
  'informatics-222': [511, 182, 50, 64],
  'stairs-west-2': [0, 331, 62, 96],
  'chemistry-biology-202': [86, 245, 62, 83],
  'assistant-202': [86, 328, 62, 55],
  'practical-225': [86, 383, 62, 34],
  'electrical-lab-207': [0, 478, 78, 82],
  'biotech-lab-225': [78, 431, 70, 128],
}

const corridorGraphs = {
  1: {
    nodes: {
      west: [73, 168], center: [318, 168], east: [579, 168],
      westMid: [73, 245], westSouth: [73, 350], westEnd: [73, 468],
    },
    edges: [['west', 'center'], ['center', 'east'], ['west', 'westMid'], ['westMid', 'westSouth'], ['westSouth', 'westEnd']],
  },
  2: {
    nodes: {
      west: [73, 168], center: [322, 168], east: [585, 168],
      westMid: [73, 280], westSouth: [73, 420], westEnd: [73, 500],
    },
    edges: [['west', 'center'], ['center', 'east'], ['west', 'westMid'], ['westMid', 'westSouth'], ['westSouth', 'westEnd']],
  },
}

const corridorLabels = {
  west: 'Западный коридор',
  center: 'Центральный коридор',
  east: 'Восточный коридор',
  westMid: 'У западной лестницы',
  westSouth: 'Нижнее крыло',
  westEnd: 'У южной лестницы',
}

function roomDoor(room) {
  const [x, y, width, height] = planRoomBounds[room.id]
  const [side, position = 0.5] = room.map.door || ['top', 0.5]
  if (side === 'bottom') return [x + width * position, y + height]
  if (side === 'left') return [x, y + height * position]
  if (side === 'right') return [x + width, y + height * position]
  return [x + width * position, y]
}

function manhattanDistance(first, second) {
  return Math.abs(first[0] - second[0]) + Math.abs(first[1] - second[1])
}

function nearestNode(point, nodes) {
  return Object.keys(nodes).reduce((closest, key) => (
    manhattanDistance(point, nodes[key]) < manhattanDistance(point, nodes[closest]) ? key : closest
  ), Object.keys(nodes)[0])
}

function shortestNodePath(graph, startKey, endKey) {
  const distances = new Map([[startKey, 0]])
  const previous = new Map()
  const pending = new Set(Object.keys(graph.nodes))

  while (pending.size) {
    const current = [...pending].reduce((best, key) => distances.get(key) < distances.get(best) ? key : best)
    if (!Number.isFinite(distances.get(current))) break
    pending.delete(current)
    if (current === endKey) break

    graph.edges.filter(([first, second]) => first === current || second === current).forEach(([first, second]) => {
      const neighbor = first === current ? second : first
      if (!pending.has(neighbor)) return
      const distance = distances.get(current) + manhattanDistance(graph.nodes[current], graph.nodes[neighbor])
      if (distance < (distances.get(neighbor) ?? Infinity)) {
        distances.set(neighbor, distance)
        previous.set(neighbor, current)
      }
    })
  }

  const path = [endKey]
  while (path[0] !== startKey && previous.has(path[0])) path.unshift(previous.get(path[0]))
  return path[0] === startKey ? path : [startKey]
}

function transferRoom(floor, transition) {
  return rooms.find((room) => room.id === (transition === 'stairs' ? `stairs-middle-${floor}` : `lift-${floor}`))
}

export function calculateIndoorRoute(startId, targetId, floor, transition = 'lift') {
  const graph = corridorGraphs[floor]
  const startRoom = rooms.find((room) => room.id === startId)
  const targetRoom = rooms.find((room) => room.id === targetId)
  if (!graph || !startRoom || !targetRoom) return { points: [], waypoints: [] }

  const routeStart = startRoom.floor === floor ? startRoom : transferRoom(floor, transition)
  const routeEnd = targetRoom.floor === floor ? targetRoom : transferRoom(floor, transition)
  if (!routeStart || !routeEnd || !planRoomBounds[routeStart.id] || !planRoomBounds[routeEnd.id]) return { points: [], waypoints: [] }

  const startDoor = roomDoor(routeStart)
  const endDoor = roomDoor(routeEnd)
  const startNode = nearestNode(startDoor, graph.nodes)
  const endNode = nearestNode(endDoor, graph.nodes)
  const nodePath = shortestNodePath(graph, startNode, endNode)
  const startConnector = [startDoor, [startDoor[0], graph.nodes[startNode][1]], graph.nodes[startNode]]
  const endConnector = [graph.nodes[endNode], [endDoor[0], graph.nodes[endNode][1]], endDoor]
  const points = [...startConnector, ...nodePath.slice(1).map((key) => graph.nodes[key]), ...endConnector]
    .filter((point, index, all) => index === 0 || point[0] !== all[index - 1][0] || point[1] !== all[index - 1][1])

  return {
    points,
    waypoints: nodePath.slice(1, -1).map((key) => corridorLabels[key]),
    startLabel: roomName(routeStart),
    endLabel: roomName(routeEnd),
  }
}

function roomName(room) {
  return `${room.name}${room.number ? ` №${room.number}` : ''}`
}