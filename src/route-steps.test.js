import test from 'node:test'
import assert from 'node:assert/strict'
import { rooms } from './data.js'
import { buildIndoorRoute } from './map-routing.js'
import { buildRouteSteps, buildTripSteps } from './route-steps.js'

const name = (room) => `${room.name}${room.number ? ` №${room.number}` : ''}`

function stepsFor(fromId, toId, transition = 'stairs') {
  const from = rooms.find((room) => room.id === fromId)
  const to = rooms.find((room) => room.id === toId)
  const route = buildIndoorRoute(from.id, to.id, transition)
  return {
    route,
    steps: buildRouteSteps({
      startLabel: name(from),
      startFloor: from.floor,
      targetFloor: to.floor,
      targetName: name(to),
      route,
      sameRoom: from.floor === to.floor && route.length === 0,
    }),
  }
}

test('a route keeps the start, the wing guides, the transfer and the arrival', () => {
  const { route, steps } = stepsFor('class-162', 'auditorium-104')
  assert.equal(steps[0].kind, 'start')
  assert.deepEqual(steps[0].voiceCue, ['route-built'], 'первый шаг не должен молчать без русского голоса на iPhone')
  assert.equal(steps.at(-1).kind, 'arrive')
  assert.equal(steps.at(-1).floor, 1)
  assert.deepEqual(steps.map((step) => step.kind), ['start', 'guide', 'guide', 'arrive'])
  assert.match(steps[2].title, /Главный коридор/)
  // Точка каждого шага лежит внутри своей части маршрута.
  for (const step of steps) {
    const leg = route.byFloor[step.floor]
    assert.ok(step.progress >= 0 && step.progress < leg.points.length, `${step.title}: ${step.progress}`)
  }
})

test('steps move forward inside a floor and never skip the arrival', () => {
  for (const from of rooms) for (const to of rooms) {
    const { route, steps } = stepsFor(from.id, to.id)
    assert.ok(steps.length >= 1)
    assert.equal(steps[0].kind, 'start')
    const byFloor = new Map()
    for (const step of steps) {
      assert.ok(step.say.length > 3 && step.title && step.detail, `${from.id} -> ${to.id}`)
      const leg = route.byFloor[step.floor]
      assert.ok(leg, `${from.id} -> ${to.id}: шаг ссылается на этаж без маршрута`)
      assert.ok(step.progress < leg.points.length, `${from.id} -> ${to.id}`)
      const previous = byFloor.get(step.floor)
      if (previous !== undefined) assert.ok(step.progress >= previous, `${from.id} -> ${to.id}: шаг откатывает точку назад`)
      byFloor.set(step.floor, step.progress)
    }
    if (from.floor !== to.floor) {
      const transfer = steps.find((step) => step.kind === 'transfer')
      assert.ok(transfer, `${from.id} -> ${to.id}: нет шага перехода между этажами`)
      assert.equal(transfer.floor, from.floor)
      assert.equal(steps.at(-1).kind, 'arrive')
      assert.equal(steps.at(-1).floor, to.floor)
      assert.equal(steps.at(-1).progress, route.byFloor[to.floor].points.length - 1)
    }
  }
})

test('a route to your own room is a single step', () => {
  const route = buildIndoorRoute('library-214', 'library-214')
  const steps = buildRouteSteps({
    startLabel: name(rooms[22]),
    startFloor: 2,
    targetFloor: 2,
    targetName: 'Библиотека №214',
    route,
    sameRoom: true,
  })
  assert.equal(steps.length, 1)
  assert.equal(steps[0].title, 'Вы уже на месте')
  assert.deepEqual(steps[0].voiceCue, ['arrive'])
})

test('the arrival step says on which side the door is', () => {
  const { steps } = stepsFor('entrance-1', 'class-118')
  assert.match(steps.at(-1).detail, /^Дверь справа, после: 119/)
  assert.match(steps.at(-1).say, /Дверь справа/)
})

test('a trip through a stop keeps one start, marks the stop and numbers the legs', () => {
  const first = stepsFor('entrance-1', 'changing-room')
  const second = stepsFor('changing-room', 'physics-211')
  const leg = (fromId, toId, route) => {
    const from = rooms.find((room) => room.id === fromId)
    const to = rooms.find((room) => room.id === toId)
    return { startLabel: name(from), startFloor: from.floor, targetFloor: to.floor, targetName: name(to), route, sameRoom: false }
  }
  const steps = buildTripSteps([leg('entrance-1', 'changing-room', first.route), leg('changing-room', 'physics-211', second.route)])
  assert.equal(steps.filter((step) => step.kind === 'start').length, 1)
  const stop = steps.find((step) => step.kind === 'stop')
  assert.equal(stop.title, 'Остановка: Раздевалка')
  assert.equal(stop.leg, 0)
  assert.equal(steps.at(-1).kind, 'arrive')
  assert.equal(steps.at(-1).leg, 1)
  assert.equal(steps.length, first.steps.length + second.steps.length - 1)
})
