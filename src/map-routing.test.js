import test from 'node:test'
import assert from 'node:assert/strict'
import { rooms } from './data.js'
import { isInsidePlan, planRoomBounds, planSizes, pointInPolygon, roomAccess, roomOutline } from './map-geometry.js'
import { buildIndoorRoute, calculateIndoorRoute } from './map-routing.js'

function length(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]) }

function checkLeg(leg, floor, allowed = []) {
  assert.ok(leg.points.length > 0, `no route on floor ${floor}`)
  const size = planSizes[floor]
  for (let i = 0; i < leg.points.length; i++) {
    const point = leg.points[i]
    assert.ok(point[0] >= 0 && point[0] <= size.width && point[1] >= 0 && point[1] <= size.height, `route outside floor ${floor}: ${point}`)
    if (i === 0) continue
    const previous = leg.points[i - 1]
    assert.ok(previous[0] === point[0] || previous[1] === point[1], `diagonal segment on floor ${floor}: ${previous} -> ${point}`)
    // Sample the open part of every segment (endpoints can lie on door frames).
    const samples = Math.ceil(length(point, previous) * 2)
    for (let j = 1; j < samples; j++) {
      const sample = [previous[0] + (point[0] - previous[0]) * j / samples, previous[1] + (point[1] - previous[1]) * j / samples]
      assert.ok(isInsidePlan(floor, sample, rooms), `left the plan on floor ${floor}: ${previous} -> ${point}`)
      const illegal = rooms.find((room) => room.floor === floor && !allowed.includes(room.id) &&
        pointInPolygon(sample, roomOutline(room.id)) && !roomOutline(room.id).some(([x, y], n, polygon) => {
          const next = polygon[(n + 1) % polygon.length]
          return Math.abs((sample[0] - x) * (next[1] - y) - (sample[1] - y) * (next[0] - x)) < 1e-5 &&
            sample[0] >= Math.min(x, next[0]) && sample[0] <= Math.max(x, next[0]) && sample[1] >= Math.min(y, next[1]) && sample[1] <= Math.max(y, next[1])
        }))
      assert.equal(illegal, undefined, `crossed ${illegal?.id} on floor ${floor}: ${previous} -> ${point}`)
    }
  }
}

test('each mapped room has a bounded hit area and a doorway', () => {
  for (const room of rooms) {
    const [x, y, width, height] = planRoomBounds[room.id] || []
    const size = planSizes[room.floor]
    assert.ok(roomAccess[room.id], room.id)
    assert.ok(width > 0 && height > 0 && x >= 0 && y >= 0 && x + width <= size.width && y + height <= size.height, room.id)
    assert.ok(isInsidePlan(room.floor, roomAccess[room.id].door, rooms), room.id)
  }
  assert.equal(isInsidePlan(2, [75, 450], rooms), true)
  assert.equal(isInsidePlan(2, [740, 540], rooms), false)
  assert.equal(pointInPolygon([82, 450], roomOutline('biotech-lab-225')), false, 'room 225 must not overlap the corridor')
})

test('routes stay in circulation or in their own rooms, never through another room', () => {
  for (const from of rooms) for (const to of rooms) {
    const route = buildIndoorRoute(from.id, to.id, 'stairs')
    assert.ok(route.byFloor[from.floor]?.points.length, `${from.id} -> ${to.id}`)
    assert.ok(route.byFloor[to.floor]?.points.length, `${from.id} -> ${to.id}`)
    for (const floor of [1, 2]) {
      const leg = route.byFloor[floor]
      if (!leg) continue
      const allowed = [from.id, to.id, 'hall-1']
      if (route.transfer) allowed.push(route.transfer.startId, route.transfer.endId)
      checkLeg(leg, floor, allowed)
    }
  }
})

test('every leg carries step guides that point at a real vertex of the route', () => {
  for (const from of rooms) for (const to of rooms) {
    const route = buildIndoorRoute(from.id, to.id, 'stairs')
    for (const [floor, leg] of Object.entries(route.byFloor)) {
      let previous = -1
      for (const guide of leg.guides) {
        assert.ok(Number.isInteger(guide.index), `${from.id} -> ${to.id}: index must be a whole vertex number`)
        assert.ok(guide.index > 0 && guide.index < leg.points.length, `${from.id} -> ${to.id}: guide ${guide.index} outside leg`)
        assert.ok(guide.index > previous, `${from.id} -> ${to.id}: guides must move forward`)
        previous = guide.index
        assert.ok(guide.title && guide.say && guide.detail, `${from.id} -> ${to.id}: guide needs text`)
        // Точка-поводырь обязана стоять на самой линии маршрута.
        const point = leg.points[guide.index]
        assert.ok(Number.isFinite(point[0]) && Number.isFinite(point[1]))
      }
      assert.ok(Number(floor) === from.floor || Number(floor) === to.floor)
    }
  }
})

test('corridor guides name the wing and never repeat the same vertex twice', () => {
  const cross = buildIndoorRoute('class-162', 'auditorium-104', 'stairs').byFloor[1]
  // Подсказки стоят в начале своих участков: поворот в западное крыло -> вход
  // в главный коридор -> выход в холл.
  assert.deepEqual(cross.guides.map((guide) => guide.index), [1, 2, 3])
  assert.equal(cross.guides[0].kind, 'west-corridor')
  assert.deepEqual(cross.points[cross.guides[0].index], [73, 450], 'точка стоит там, где начинается поворот')
  assert.match(cross.guides[1].title, /Главный коридор · к холлу/)
  assert.match(cross.guides[2].say, /актового зала/)
  assert.deepEqual(cross.points[cross.guides[1].index], [73, 168], 'главный коридор начинается от западного перекрёстка')
  const secondFloor = buildIndoorRoute('radio-lab-228', 'canteen', 'stairs').byFloor[2]
  assert.match(secondFloor.guides[0].say, /лабораторий/, 'на втором этаже восточный коридор ведёт к лабораториям')
  const firstFloor = buildIndoorRoute('radio-lab-228', 'canteen', 'stairs').byFloor[1]
  assert.match(firstFloor.guides[0].say, /западного крыла/)
})

test('the auditorium is reached through the entrance hall, not through its north wall', () => {
  const leg = calculateIndoorRoute('canteen', 'auditorium-104', 1)
  assert.deepEqual(leg.points.at(-1), [610, 205])
  assert.ok(leg.points.some(([x, y]) => x === 579 && y === 205))
  checkLeg(leg, 1, ['canteen', 'hall-1', 'auditorium-104'])
})

test('west and north stairwells connect to their counterpart and use the nearer stairwell', () => {
  for (const wing of ['west', 'middle', 'north']) {
    const first = rooms.find((room) => room.id === `stairs-${wing}-1`)
    const second = rooms.find((room) => room.id === `stairs-${wing}-2`)
    assert.ok(first && second)
  }
  const route = buildIndoorRoute('class-162', 'biotech-lab-225', 'stairs')
  assert.equal(route.transfer.kind, 'stairs-west')
  assert.deepEqual(route.byFloor[1].points.at(0), roomAccess['class-162'].door)
  assert.deepEqual(route.byFloor[2].points.at(-1), roomAccess['biotech-lab-225'].door)
  assert.deepEqual(calculateIndoorRoute('class-162', 'biotech-lab-225', 2, 'stairs').points, route.byFloor[2].points)
})

test('a manually placed point anywhere in a room or corridor can start a route', () => {
  for (const position of [[2, 82, 530], [2, 72, 430], [1, 580, 220], [1, 300, 170], [2, 118, 131]]) {
    const [floor, x, y] = position
    const route = buildIndoorRoute({ floor, x, y }, 'canteen', 'stairs')
    assert.deepEqual(route.byFloor[floor].points[0], [x, y])
    for (const [key, leg] of Object.entries(route.byFloor)) {
      const allow = ['canteen', 'hall-1', 'biotech-lab-225', 'electrical-lab-207', route.transfer?.startId, route.transfer?.endId].filter(Boolean)
      checkLeg(leg, Number(key), allow)
    }
  }
  assert.equal(buildIndoorRoute({ floor: 2, x: 740, y: 550 }, 'canteen').length, 0)
  const alreadyHere = buildIndoorRoute({ floor: 2, x: 100, y: 530 }, 'biotech-lab-225')
  assert.equal(alreadyHere.length, 0)
  assert.deepEqual(alreadyHere.byFloor[2].points, [[100, 530]])
})
