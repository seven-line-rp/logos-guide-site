import test from 'node:test'
import assert from 'node:assert/strict'
import { findNearest, nearbyKinds, roomTitle } from './places.js'
import { arrivalStatus, formatCountdown, nextLesson, parseSchedule, validLesson } from './schedule.js'
import { activeNotices, avoidClosed, closedRoomIds, validNotice } from './notices.js'
import { buildRouteOptions } from './map-routing.js'
import { tourLeg, tours } from './tours.js'
import { rooms } from './data.js'
import { routeLink } from './share.js'

test('nearest place is found by walking time, not straight distance', () => {
  for (const kind of nearbyKinds) assert.ok(findNearest('entrance-1', kind.id), kind.id)
  const toilet = findNearest('physics-211', 'toilet')
  assert.equal(toilet.room.floor, 2) // со второго этажа не ведём вниз
  assert.equal(findNearest('entrance-1', 'exit', 'entrance-1'), null)
  assert.equal(findNearest('entrance-1', 'nope'), null)
  assert.equal(roomTitle('physics-211'), 'Кабинет физики №211')
})

test('next lesson and arrival status', () => {
  const lessons = parseSchedule(JSON.stringify([
    { day: 1, start: '08:30', end: '10:00', subject: 'Физика', roomId: 'physics-211' },
    { day: 1, start: '10:10', end: '11:40', subject: 'Информатика', roomId: 'informatics-222' },
    { day: 3, start: '12:10', end: '13:40', subject: 'Химия', roomId: 'chemistry-biology-202' },
    { day: 9, start: '12:10', end: '13:40', subject: 'Плохая', roomId: 'physics-211' },
  ]))
  assert.equal(lessons.length, 3)
  const monday = new Date(2026, 9, 19, 9, 0) // понедельник
  assert.deepEqual([nextLesson(lessons, monday).lesson.subject, nextLesson(lessons, monday).ongoing], ['Физика', true])
  const break_ = new Date(2026, 9, 19, 10, 2)
  assert.deepEqual([nextLesson(lessons, break_).lesson.subject, nextLesson(lessons, break_).minutes], ['Информатика', 8])
  assert.equal(nextLesson(lessons, new Date(2026, 9, 19, 18, 0)).lesson.subject, 'Химия')
  assert.equal(nextLesson(lessons, new Date(2026, 9, 25, 12, 0)).lesson.subject, 'Физика') // воскресенье → понедельник
  assert.equal(nextLesson([], monday), null)
  assert.equal(arrivalStatus(120, 10).kind, 'ok')
  assert.equal(arrivalStatus(120, 3).kind, 'tight')
  assert.equal(arrivalStatus(300, 2).kind, 'late')
  assert.equal(arrivalStatus(60, -5).kind, 'late')
  assert.equal(formatCountdown(8), 'через 8 мин')
  assert.equal(validLesson({ day: 1, start: '10:00', end: '09:00', subject: 'x', roomId: 'physics-211' }), false)
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
