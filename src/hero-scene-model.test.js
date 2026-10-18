import test from 'node:test'
import assert from 'node:assert/strict'
import { rooms } from './data.js'
import { roomOutline } from './map-geometry.js'
import { buildRouteOptions } from './map-routing.js'
import { HERO_ROUTE, floorDoors, floorWalls, transferColumns } from './hero-scene-model.js'

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

test('the showcase route exists and crosses floors by its staircase', () => {
  const option = buildRouteOptions(HERO_ROUTE.from, HERO_ROUTE.to).find((item) => item.kind === HERO_ROUTE.via)
  assert.ok(option, 'route option exists')
  assert.ok(option.byFloor[1].points.length > 1 && option.byFloor[2].points.length > 1)
})

test('the camera flight is continuous and loops back to the opening shot', async () => {
  const { buildFlight } = await import('./hero-scene-model.js')
  const option = buildRouteOptions(HERO_ROUTE.from, HERO_ROUTE.to).find((item) => item.kind === HERO_ROUTE.via)
  const flight = buildFlight(option.byFloor[1].points, option.byFloor[2].points)
  const steps = 2000
  let previous = flight(0).camera
  for (let index = 1; index <= steps; index += 1) {
    const frame = flight(index / steps)
    const camera = frame.camera
    for (const key of ['x', 'y', 'z', 'zoom', 'tilt', 'yaw']) assert.ok(Number.isFinite(camera[key]), key)
    // Ни одного рывка: за 1/2000 цикла (10 мс) камера сдвигается плавно.
    assert.ok(Math.hypot(camera.x - previous.x, camera.y - previous.y) < 8, `jump at ${index}`)
    assert.ok(Math.abs(camera.yaw - previous.yaw) < 6 || index === steps, `spin at ${index}`)
    assert.ok(frame.lower >= 0 && frame.lower <= 1 && frame.upper >= 0 && frame.upper <= 1)
    previous = camera
  }
  const start = flight(0).camera
  const end = flight(0.99999).camera
  assert.ok(Math.abs(start.x - end.x) < 1 && Math.abs(start.zoom - end.zoom) < 0.01, 'loop closes on the wide shot')
  assert.ok(Math.abs(((start.yaw - end.yaw) % 360 + 360) % 360) < 1 || Math.abs(((start.yaw - end.yaw) % 360 + 360) % 360 - 360) < 1)
})
