import test from 'node:test'
import assert from 'node:assert/strict'
import { findNearest, nearbyKinds, roomTitle } from './places.js'
import { addDays, arrivalStatus, bellState, bellsFor, dayLabel, formatCountdown, nextLesson, parseSchedule, validLesson } from './schedule.js'
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

test('next lesson by date, bells and arrival status', () => {
  const lessons = parseSchedule(JSON.stringify([
    { date: '2026-10-19', start: '09:40', end: '11:10', subject: 'Физика', roomId: 'physics-211' },
    { date: '2026-10-19', start: '11:20', end: '12:50', subject: 'Информатика', roomId: 'informatics-222' },
    { date: '2026-10-21', start: '12:30', end: '14:00', subject: 'Химия', roomId: 'chemistry-biology-202' },
    { date: '2026-10-01', start: '09:00', end: '10:30', subject: 'Старая', roomId: 'physics-211' },
    { day: 1, start: '12:10', end: '13:40', subject: 'Без даты', roomId: 'physics-211' },
  ]), '2026-10-19')
  assert.deepEqual(lessons.map((lesson) => lesson.subject), ['Физика', 'Информатика', 'Химия']) // старые и без даты отброшены
  const monday = new Date(2026, 9, 19, 10, 0)
  assert.deepEqual([nextLesson(lessons, monday).lesson.subject, nextLesson(lessons, monday).ongoing], ['Физика', true])
  const breakTime = new Date(2026, 9, 19, 11, 12)
  assert.deepEqual([nextLesson(lessons, breakTime).lesson.subject, nextLesson(lessons, breakTime).minutes], ['Информатика', 8])
  const evening = nextLesson(lessons, new Date(2026, 9, 19, 18, 0))
  assert.deepEqual([evening.lesson.subject, evening.offset], ['Химия', 2])
  assert.equal(nextLesson(lessons, new Date(2026, 9, 22, 9, 0)), null)
  assert.equal(arrivalStatus(120, 10).kind, 'ok')
  assert.equal(arrivalStatus(120, 3).kind, 'tight')
  assert.equal(arrivalStatus(300, 2).kind, 'late')
  assert.equal(arrivalStatus(60, -5).kind, 'late')
  assert.equal(formatCountdown(8), 'через 8 мин')
  assert.equal(validLesson({ date: '2026-10-19', start: '10:00', end: '09:00', subject: 'x', roomId: 'physics-211' }), false)
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
  assert.equal(dayLabel('2026-10-20', '2026-10-19').name, 'Завтра')
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
