import test from 'node:test'
import assert from 'node:assert/strict'
import { rooms } from './data.js'
import { roomOutline } from './map-geometry.js'
import { buildRouteOptions } from './map-routing.js'
import { HERO_ROUTES, floorDoors, floorWalls, transferColumns } from './hero-scene-model.js'

test('walls are generated once per edge on both floors', () => {
  for (const floor of [1, 2]) {
    const walls = floorWalls(floor)
    assert.ok(walls.length > 40, `floor ${floor} has walls`)
    const keys = walls.map((wall) => `${wall.x},${wall.y},${wall.length},${Math.abs(wall.angle) % 180}`)
    assert.equal(new Set(keys).size, keys.length, `floor ${floor} walls are unique`)
    for (const wall of walls) assert.ok(wall.length >= 1 && Number.isFinite(wall.angle))
  }
})

test('every door sits on a wall of its own room', () => {
  for (const floor of [1, 2]) {
    for (const door of floorDoors(floor)) {
      const outline = roomOutline(door.id)
      const rad = door.angle * Math.PI / 180
      const middle = [door.x + Math.cos(rad) * door.width / 2, door.y + Math.sin(rad) * door.width / 2]
      const onEdge = outline.some(([x1, y1], index) => {
        const [x2, y2] = outline[(index + 1) % outline.length]
        const cross = (middle[0] - x1) * (y2 - y1) - (middle[1] - y1) * (x2 - x1)
        const within = middle[0] >= Math.min(x1, x2) - .2 && middle[0] <= Math.max(x1, x2) + .2 && middle[1] >= Math.min(y1, y2) - .2 && middle[1] <= Math.max(y1, y2) + .2
        return Math.abs(cross) / Math.hypot(x2 - x1, y2 - y1) < .2 && within
      })
      assert.ok(onEdge, `${door.id} door is on its wall`)
    }
  }
})

test('transfer columns cover every staircase and the lift', () => {
  const ids = transferColumns().map((column) => column.id).sort()
  const expected = rooms.filter((room) => room.floor === 1 && /^(stairs-|lift-)/.test(room.id)).map((room) => room.id).sort()
  assert.deepEqual(ids, expected)
})

test('every showcase route exists and crosses floors by its own staircase or lift', () => {
  assert.equal(HERO_ROUTES.length, 7)
  assert.ok(HERO_ROUTES.some((route) => route.via === 'lift') && HERO_ROUTES.some((route) => route.via.startsWith('stairs-')))
  for (const route of HERO_ROUTES) {
    const option = buildRouteOptions(route.from, route.to).find((item) => item.kind === route.via)
    assert.ok(option, `${route.from} → ${route.to} via ${route.via}`)
    assert.ok(option.byFloor[1].points.length > 1 && option.byFloor[2].points.length > 1)
  }
})

test('each camera flight is continuous, climbs smoothly and loops back to the opening shot', async () => {
  const { buildFlight, stairSteps, STAIR_STEPS } = await import('./hero-scene-model.js')
  const columns = transferColumns()
  for (const route of HERO_ROUTES) {
    const option = buildRouteOptions(route.from, route.to).find((item) => item.kind === route.via)
    const lower = option.byFloor[1].points
    const upper = option.byFloor[2].points
    const column = columns.find((item) => item.id === `${route.via}-1`)
    const transfer = route.via === 'lift' ? { kind: 'lift', center: [column.x, column.y] } : { kind: 'stairs' }
    const flight = buildFlight(lower, upper, 150, transfer)
    const steps = 4000
    let previous = flight(0)
    let sawClimb = false
    for (let index = 1; index <= steps; index += 1) {
      const frame = flight(index / steps)
      const camera = frame.camera
      for (const key of ['x', 'y', 'z', 'zoom', 'tilt', 'yaw']) assert.ok(Number.isFinite(camera[key]), key)
      // Ни одного рывка: за 1/4000 цикла (5 мс) камера и подъём сдвигаются плавно.
      assert.ok(Math.hypot(camera.x - previous.camera.x, camera.y - previous.camera.y) < 8, `${route.to}: jump at ${index}`)
      assert.ok(Math.abs(camera.z - previous.camera.z) < 2.5, `${route.to}: z jump at ${index}`)
      assert.ok(Math.abs(camera.yaw - previous.camera.yaw) < 6 || index === steps, `${route.to}: spin at ${index}`)
      assert.ok(frame.lower >= 0 && frame.lower <= 1 && frame.upper >= 0 && frame.upper <= 1)
      assert.ok(frame.climb.vis >= 0 && frame.climb.vis <= 1 && frame.climb.door >= 0 && frame.climb.door <= 1)
      if (frame.climb.progress > 0 && frame.climb.progress < 1) sawClimb = true
      previous = frame
    }
    assert.ok(sawClimb, `${route.to}: the climb is shown`)
    const start = flight(0).camera
    const end = flight(0.99999).camera
    assert.ok(Math.abs(start.x - end.x) < 1 && Math.abs(start.zoom - end.zoom) < 0.01, 'loop closes on the wide shot')
    assert.ok(Math.abs(((start.yaw - end.yaw) % 360 + 360) % 360) < 1 || Math.abs(((start.yaw - end.yaw) % 360 + 360) % 360 - 360) < 1)
    if (route.via !== 'lift') {
      const marsh = stairSteps(lower.at(-1), upper[0])
      assert.equal(marsh.length, STAIR_STEPS)
      assert.ok(marsh.every((step) => step.k > 0 && step.k < 1))
    }
  }
})

test('walls open up where the route goes, and stay whole elsewhere', async () => {
  const { doorsOnRoute, floorDoors, floorWalls, openWalls } = await import('./hero-scene-model.js')
  const wall = { x: 0, y: 10, length: 100, angle: 0 }
  assert.deepEqual(openWalls([wall], []), [wall], 'без маршрута стены не трогаем')
  assert.deepEqual(openWalls([wall], [[0, 50], [100, 50]]), [wall], 'путь рядом, но не через стену')
  // Путь пересекает стену в середине: остаются два куска и проход 15 единиц.
  assert.deepEqual(openWalls([wall], [[50, 0], [50, 30]]), [{ x: 0, y: 10, length: 42.5, angle: 0 }, { x: 57.5, y: 10, length: 42.5, angle: 0 }])
  // Путь идёт прямо по стене: открываем весь этот участок.
  assert.deepEqual(openWalls([wall], [[20, 10], [60, 10]]), [{ x: 0, y: 10, length: 12.5, angle: 0 }, { x: 67.5, y: 10, length: 32.5, angle: 0 }])
  // Стена под углом: считаем в её собственных координатах.
  const tilted = openWalls([{ x: 0, y: 0, length: 100, angle: 90 }], [[-20, 50], [20, 50]])
  assert.deepEqual(tilted.map((item) => [item.x, item.y, item.length]), [[0, 0, 42.5], [0, 57.5, 42.5]])
  assert.equal(openWalls([{ x: 0, y: 0, length: 12, angle: 0 }], [[6, -5], [6, 5]]).length, 0, 'короткая стена на пути убирается целиком')

  // На настоящем плане ни один отрезок маршрута не пересекает оставшиеся стены.
  const { buildRouteOptions } = await import('./map-routing.js')
  const crosses = (a, b, w) => {
    const rad = w.angle * Math.PI / 180
    const [ux, uy] = [Math.cos(rad), Math.sin(rad)]
    const side = ([x, y]) => -(x - w.x) * uy + (y - w.y) * ux
    const along = ([x, y]) => (x - w.x) * ux + (y - w.y) * uy
    const [da, db] = [side(a), side(b)]
    if (Math.abs(da) < 0.01 || Math.abs(db) < 0.01 || (da > 0) === (db > 0)) return false
    const t = along(a) + (along(b) - along(a)) * (da / (da - db))
    return t > 0.01 && t < w.length - 0.01
  }
  for (const [from, to] of [['entrance-1', 'physics-211'], ['canteen', 'radio-lab-228'], ['auditorium-104', 'library-214'], ['class-139', 'medical-post']]) {
    for (const option of buildRouteOptions(from, to)) {
      for (const floor of [1, 2]) {
        const points = option.byFloor[floor]?.points || []
        if (points.length < 2) continue
        const walls = openWalls(floorWalls(floor), points)
        assert.ok(walls.length >= floorWalls(floor).length - 4 || walls.length > 50, 'стены не пропали целиком')
        for (let index = 1; index < points.length; index += 1) {
          const hit = walls.find((item) => crosses(points[index - 1], points[index], item))
          assert.equal(hit, undefined, `${from} → ${to} (${option.kind}), ${floor} этаж: путь упирается в стену`)
        }
        const doors = floorDoors(floor)
        assert.ok(doorsOnRoute(doors, points).size <= 4, 'убираем только двери на пути')
      }
    }
  }
})
