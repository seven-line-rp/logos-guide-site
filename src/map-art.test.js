import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { rooms } from './data.js'
import { planDecor, planRoomBounds, pointInPolygon, roomOutline } from './map-geometry.js'
import { PLAN_ROOMS_MARKER, composePlanArt, planLabels } from './map-art.js'

const boxOutline = ([x, y, width, height]) => [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]

function shapesOnFloor(floor) {
  return [
    ...rooms.filter((room) => room.floor === floor).map((room) => ({ id: room.id, outline: roomOutline(room.id), box: planRoomBounds[room.id] })),
    ...planDecor[floor].map((item, index) => ({ id: `decor-${floor}-${index}`, outline: boxOutline(item.box), box: item.box })),
  ]
}

// Шаг 0.5 по сетке внутри пересечения рамок: точка, лежащая строго внутри
// двух контуров сразу, означает, что помещения залезают друг на друга.
function overlapPoint(a, b) {
  const left = Math.max(a.box[0], b.box[0])
  const right = Math.min(a.box[0] + a.box[2], b.box[0] + b.box[2])
  const top = Math.max(a.box[1], b.box[1])
  const bottom = Math.min(a.box[1] + a.box[3], b.box[1] + b.box[3])
  for (let x = left + 0.25; x < right; x += 0.5) {
    for (let y = top + 0.25; y < bottom; y += 0.5) {
      const inside = (outline) => pointInPolygon([x, y], outline) && !outline.some(([px, py], index) => {
        const [qx, qy] = outline[(index + 1) % outline.length]
        return Math.abs((x - px) * (qy - py) - (y - py) * (qx - px)) < 1e-6
      })
      if (inside(a.outline) && inside(b.outline)) return [x, y]
    }
  }
  return null
}

test('rooms, stairs and shafts never overlap on either floor', () => {
  for (const floor of [1, 2]) {
    const shapes = shapesOnFloor(floor)
    for (let i = 0; i < shapes.length; i += 1) {
      for (let j = i + 1; j < shapes.length; j += 1) {
        assert.equal(overlapPoint(shapes[i], shapes[j]), null, `${shapes[i].id} overlaps ${shapes[j].id}`)
      }
    }
  }
})

test('irregular rooms stay inside their bounding boxes', () => {
  for (const room of rooms) {
    const [x, y, width, height] = planRoomBounds[room.id]
    for (const [px, py] of roomOutline(room.id)) {
      assert.ok(px >= x - 1e-6 && px <= x + width + 1e-6 && py >= y - 1e-6 && py <= y + height + 1e-6, `${room.id}: ${px},${py}`)
    }
  }
})

test('the drawn plan takes every room shape from the geometry', () => {
  for (const [floor, file] of [[1, 'map1lower.svg'], [2, 'map2lower.svg']]) {
    const raw = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    assert.ok(raw.includes(PLAN_ROOMS_MARKER), `${file} has the room marker`)
    assert.doesNotMatch(raw, /fill="#DFE6FF"/, `${file} has no hand-drawn rooms left`)
    const art = composePlanArt(raw, floor)
    assert.ok(!art.includes(PLAN_ROOMS_MARKER))
    for (const room of rooms.filter((item) => item.floor === floor)) assert.ok(art.includes(`data-room="${room.id}"`), room.id)
  }
})

// Надписи второго этажа «ХОЛЛ» и «АКТОВЫЙ ЗАЛ · 1 этаж» стоят в холле и над
// залом первого этажа — это не помещения карты, поэтому проверяем только первый этаж.
test('word labels exist in both languages; first-floor labels sit inside rooms', () => {
  for (const floor of [1, 2]) {
    const raw = readFileSync(new URL(`../map${floor}lower.svg`, import.meta.url), 'utf8')
    for (const label of planLabels[floor]) {
      assert.ok(label.ru.length > 0, `${floor}: ${label.ru}`)
      assert.ok(Array.isArray(label.en), `${floor}: ${label.ru}`)
      if (floor !== 1) continue
      const inside = shapesOnFloor(floor).some((shape) => pointInPolygon([label.x, label.y - label.size / 2], shape.outline))
      assert.ok(inside, `${label.ru} is inside a room`)
    }
    const english = composePlanArt(raw, floor, 'en')
    assert.doesNotMatch(english.match(/<text[^>]*>[^<]*<\/text>/g).join(''), /[А-Яа-яЁё]/, `floor ${floor} labels are translated`)
  }
})
