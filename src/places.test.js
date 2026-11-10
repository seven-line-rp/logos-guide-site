import test from 'node:test'
import assert from 'node:assert/strict'
import { findNearest, nearbyKinds, roomTitle } from './places.js'
import { addDays, arrivalStatus, bellState, bellsFor, formatCountdown, nextBell, reminderTimes } from './bells.js'
import { activeNotices, avoidClosed, closedRoomIds, validNotice } from './notices.js'
import { buildRouteOptions } from './map-routing.js'
import { tourLeg, tours } from './tours.js'
import { rooms } from './data.js'
import { meetLink, routeLink } from './share.js'

test('nearest place is found by walking time, not straight distance', () => {
  for (const kind of nearbyKinds) assert.ok(findNearest('entrance-1', kind.id), kind.id)
  const toilet = findNearest('physics-211', 'toilet')
  assert.equal(toilet.room.floor, 2) // со второго этажа не ведём вниз
  assert.equal(findNearest('entrance-1', 'exit', 'entrance-1'), null)
  assert.equal(findNearest('entrance-1', 'nope'), null)
  assert.equal(roomTitle('physics-211'), 'Кабинет физики №211')
})

test('the next bell and whether you make it in time', () => {
  assert.deepEqual(nextBell(new Date(2026, 9, 20, 8, 50)), { label: '1-я пара', start: '09:00', minutes: 10 })
  assert.equal(nextBell(new Date(2026, 9, 19, 11, 12)).minutes, 8, 'перемена в понедельник: 2-я пара в 11:20')
  assert.equal(nextBell(new Date(2026, 9, 20, 12, 15)).start, '12:30', 'в обед считаем до следующей пары')
  assert.equal(nextBell(new Date(2026, 9, 20, 11, 0)), null, 'пара уже идёт')
  assert.equal(nextBell(new Date(2026, 9, 20, 5, 0)), null, 'до занятий больше трёх часов')
  assert.equal(nextBell(new Date(2026, 9, 25, 8, 50)), null, 'воскресенье')
  assert.equal(arrivalStatus(120, 10).kind, 'ok')
  assert.equal(arrivalStatus(120, 3).kind, 'tight')
  assert.equal(arrivalStatus(300, 2).kind, 'late')
  assert.equal(arrivalStatus(60, -5).kind, 'late')
  assert.equal(formatCountdown(8), 'через 8 мин')
})

test('lesson reminders come 5 minutes before each bell: 8:55 on weekdays, Monday has its own times', () => {
  assert.deepEqual(reminderTimes('weekday').map((bell) => bell.at), ['08:55', '10:35', '12:25', '14:15'])
  assert.deepEqual(reminderTimes('monday').map((bell) => bell.at), ['08:55', '09:35', '11:15', '13:05', '14:55'])
})

test('bells: Monday starts with РОВ, Tuesday–Friday at 9:00, lunch by course', () => {
  assert.equal(bellsFor('2026-10-19').bells[0].label, 'РОВ')
  assert.deepEqual(bellsFor('2026-10-19').bells.map((bell) => bell.start), ['09:00', '09:40', '11:20', '13:10', '15:00'])
  assert.deepEqual(bellsFor('2026-10-20').bells.map((bell) => `${bell.start}-${bell.end}`), ['09:00-10:30', '10:40-12:10', '12:30-14:00', '14:20-15:50'])
  assert.equal(bellsFor('2026-10-25').bells.length, 0) // воскресенье
  assert.deepEqual(bellState(new Date(2026, 9, 20, 11, 0)), { kind: 'lesson', bell: bellsFor('2026-10-20').bells[1], left: 70, next: bellsFor('2026-10-20').bells[2] })
  assert.equal(bellState(new Date(2026, 9, 20, 12, 15)).kind, 'lunch')
  assert.equal(bellState(new Date(2026, 9, 20, 12, 15)).course, 1)
  assert.equal(bellState(new Date(2026, 9, 19, 9, 37)).kind, 'break')
  assert.equal(bellState(new Date(2026, 9, 20, 8, 0)).kind, 'before')
  assert.equal(bellState(new Date(2026, 9, 20, 17, 0)).kind, 'over')
  assert.equal(addDays('2026-10-31', 1), '2026-11-01')
})

test('notices: dates, validation and closed stairs are avoided', () => {
  const list = [
    { type: 'closed', roomId: 'stairs-west-1', title: 'Ремонт' },
    { type: 'event', roomId: 'auditorium-104', title: 'Концерт', from: '2026-10-01T00:00:00+03:00', to: '2026-10-02T00:00:00+03:00' },
    { type: 'weird', roomId: 'auditorium-104', title: 'x' },
  ]
  assert.equal(validNotice(list[2]), false)
  assert.equal(activeNotices(list, new Date('2026-10-19')).length, 1)
  assert.equal(activeNotices(list, new Date('2026-10-01T12:00:00+03:00')).length, 2)
  const options = buildRouteOptions('entrance-1', 'physics-211')
  const open = avoidClosed(options, closedRoomIds(activeNotices(list, new Date('2026-10-19'))))
  assert.ok(open.length < options.length)
  assert.ok(open.every((option) => option.kind !== 'stairs-west'))
  assert.equal(avoidClosed(options, new Set()), options)
})

test('tours visit real rooms and every leg has a path', () => {
  for (const tour of tours) {
    tour.stops.forEach((stop, index) => {
      assert.ok(rooms.some((room) => room.id === stop.roomId), stop.roomId)
      const leg = tourLeg(tour, index)
      assert.ok(leg.points.length >= 1, `${tour.id} #${index}`)
    })
  }
})

test('share link keeps only meaningful parameters', () => {
  assert.equal(routeLink('https://x.ru', { from: 'entrance-1', to: 'physics-211', mode: 'auto' }), 'https://x.ru/route?from=entrance-1&to=physics-211')
  assert.equal(routeLink('https://x.ru', { from: 'manual', to: 'library-214', mode: 'lift' }), 'https://x.ru/route?from=manual&to=library-214&mode=lift')
})

test('meeting links carry the place and an optional time', () => {
  assert.equal(meetLink('https://x.ru', { to: 'canteen', at: '12:10' }), 'https://x.ru/route?to=canteen&meet=1&at=12%3A10')
  assert.equal(meetLink('https://x.ru', { to: 'canteen', at: '25:99' }), 'https://x.ru/route?to=canteen&meet=1')
  assert.equal(routeLink('https://x.ru', { from: 'entrance-1', to: 'physics-211', via: 'changing-room' }), 'https://x.ru/route?from=entrance-1&to=physics-211&via=changing-room')
})

test('search remembers recently opened places, newest first, without duplicates', async () => {
  const { clearRecentPlaces, readRecentPlaces, rememberPlace } = await import('./places.js')
  const data = new Map([['logos-cookie-consent', JSON.stringify({ v: 1, functional: true })]])
  globalThis.localStorage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) }
  try {
    for (const id of ['canteen', 'library-214', 'physics-211', 'canteen', 'no-such-room']) rememberPlace(id)
    assert.deepEqual(readRecentPlaces(), ['canteen', 'physics-211', 'library-214'])
    for (const id of ['auditorium-104', 'hall-1', 'class-217', 'class-119']) rememberPlace(id)
    assert.equal(readRecentPlaces().length, 5)
    clearRecentPlaces()
    assert.deepEqual(readRecentPlaces(), [])
  } finally {
    delete globalThis.localStorage
  }
})
