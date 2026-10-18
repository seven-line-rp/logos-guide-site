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

// Надписи-слова на плане. В исходных SVG они были нарисованы контурами и не
// переводились, поэтому заданы здесь текстом на двух языках. `lines` —
// строки сверху вниз; y — базовая линия первой строки, `gap` — шаг строк.
// Номера кабинетов остаются в SVG: они одинаковы на любом языке.
export const planLabels = {
  1: [
    { x: 432, y: 128.5, size: 10.5, ru: ['УЧЕБ. ЧАСТЬ'], en: ['ACADEMIC OFFICE'] },
    { x: 360, y: 197.6, size: 8.5, ru: ['КАБ.'], en: [] },
    { x: 416.2, y: 213.5, size: 8.5, ru: ['ДИРЕКТОРА'], en: ['DIRECTOR\u2019S', 'OFFICE'], enSize: 8, enY: 208.5, gap: 10 },
    { x: 683.4, y: 163.5, size: 10.5, gap: 13, ru: ['АКТОВЫЙ', 'ЗАЛ'], en: ['ASSEMBLY', 'HALL'] },
    { x: 578.9, y: 254.9, size: 7, ru: ['вход'], en: ['entrance'], enSize: 6.5 },
  ],
  2: [
    { x: 72.3, y: 60.5, size: 10.5, ru: ['БИБЛИОТЕКА'], en: ['LIBRARY'] },
    { x: 72.5, y: 151.5, size: 10.5, ru: ['ХОЛЛ'], en: ['LOBBY'] },
    { x: 391.1, y: 129.8, size: 10.5, ru: ['Л'], en: ['PREP'], enSize: 9 },
    { x: 117, y: 359.5, size: 10.5, ru: ['Л'], en: ['PREP'], enSize: 9 },
    { x: 117, y: 404, size: 10.5, ru: ['П'], en: ['PRACT.'], enSize: 8 },
    { x: 409, y: 217.3, size: 10.5, ru: ['П'], en: ['PSY'], enSize: 8 },
    { x: 699, y: 166, size: 10.5, ru: ['АКТОВЫЙ ЗАЛ'], en: ['ASSEMBLY HALL'] },
    { x: 699, y: 180, size: 8, ru: ['1 ЭТАЖ'], en: ['FLOOR 1'] },
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

function labelMarkup(label, language) {
  const english = language === 'en'
  const lines = english ? label.en : label.ru
  const size = english && label.enSize ? label.enSize : label.size
  const y = english && label.enY ? label.enY : label.y
  const gap = label.gap || size * 1.15
  return lines.map((line, index) => `<text class="plan-art-text" x="${label.x}" y="${round(y + index * gap)}" style="font-size:${size}px" text-anchor="middle">${line}</text>`).join('')
}

export function planRoomsMarkup(floor, language = 'ru') {
  const shapes = rooms
    .filter((room) => room.floor === floor)
    .map((room) => `<path data-room="${room.id}" d="${outlinePath(roomOutline(room.id))}" fill="${ROOM_FILL}" ${WALL}/>`)
  const decor = (planDecor[floor] || [])
    .map((item) => `<path d="${outlinePath(boxPoints(item.box))}" fill="${item.kind === 'shaft' ? SHAFT_FILL : ROOM_FILL}" ${WALL}/>`)
  const labels = (planLabels[floor] || []).map((label) => labelMarkup(label, language))
  return { shapes: [...shapes, ...decor].join(''), labels: labels.join('') }
}

const cache = new Map()

export function composePlanArt(svg, floor, language = 'ru') {
  const key = `${floor}:${language}:${svg.length}`
  if (cache.has(key)) return cache.get(key)
  const { shapes, labels } = planRoomsMarkup(floor, language)
  // Room fills go under corridors, icons and labels; set-in labels go on top.
  const end = svg.lastIndexOf('</svg>')
  const result = `${svg.slice(0, end)}${labels}${svg.slice(end)}`.replace(PLAN_ROOMS_MARKER, shapes)
  cache.set(key, result)
  return result
}
