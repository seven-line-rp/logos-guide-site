import { planDecor, roomOutline } from './map-geometry.js'
import { rooms } from './data.js'

// The floor SVGs keep only what is not a room: the building outline,
// corridors, labels, icons and doors. Rooms, shafts and other drawn blocks are
// added here from map-geometry.js, so the drawing and the clickable areas use
// the same wall lines and neighbouring rooms can never overlap.
export const PLAN_ROOMS_MARKER = '<!--plan-rooms-->'

const ROOM_FILL = '#DFE6FF'
const SHAFT_FILL = '#878DA2'
const WALL = 'stroke="#ACAEB3" stroke-width="1.4" stroke-linejoin="miter"'

// Labels that used to overlap in the exported drawing are set as text.
const planLabels = {
  2: [
    { x: 699, y: 166, size: 11.5, text: 'АКТОВЫЙ ЗАЛ' },
    { x: 699, y: 181, size: 8.5, text: '1 ЭТАЖ' },
  ],
}

const round = (value) => Math.round(value * 100) / 100

export function outlinePath(points) {
  if (!points.length) return ''
  return `M${points.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}Z`
}

function boxPoints([x, y, width, height]) {
  return [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]
}

export function planRoomsMarkup(floor) {
  const shapes = rooms
    .filter((room) => room.floor === floor)
    .map((room) => `<path data-room="${room.id}" d="${outlinePath(roomOutline(room.id))}" fill="${ROOM_FILL}" ${WALL}/>`)
  const decor = (planDecor[floor] || [])
    .map((item) => `<path d="${outlinePath(boxPoints(item.box))}" fill="${item.kind === 'shaft' ? SHAFT_FILL : ROOM_FILL}" ${WALL}/>`)
  const labels = (planLabels[floor] || [])
    .map((label) => `<text class="plan-art-label" x="${label.x}" y="${label.y}" font-size="${label.size}" text-anchor="middle">${label.text}</text>`)
  return { shapes: [...shapes, ...decor].join(''), labels: labels.join('') }
}

const cache = new Map()

export function composePlanArt(svg, floor) {
  const key = `${floor}:${svg.length}`
  if (cache.has(key)) return cache.get(key)
  const { shapes, labels } = planRoomsMarkup(floor)
  // Room fills go under corridors, icons and labels; set-in labels go on top.
  const end = svg.lastIndexOf('</svg>')
  const result = `${svg.slice(0, end)}${labels}${svg.slice(end)}`.replace(PLAN_ROOMS_MARKER, shapes)
  cache.set(key, result)
  return result
}
