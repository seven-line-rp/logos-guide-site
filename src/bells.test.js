import test from 'node:test'
import assert from 'node:assert/strict'
import { dayStatus, nextSchoolDay } from './bells.js'

// Вторник 17.11.2026 — обычный день (1-я пара 09:00–10:30, 2-я 10:40–12:10).
const at = (time, date = '2026-11-17') => new Date(`${date}T${time}:00`)

test('a lesson in progress shows the current pair and minutes to its end', () => {
  const status = dayStatus(at('09:05'))
  assert.equal(status.kind, 'now')
  assert.equal(status.bell.label, '1-я пара')
  assert.equal(status.left, 85)
  assert.equal(status.after.label, '2-я пара')
})

test('within 15 minutes of the next pair the status is "soon"', () => {
  const status = dayStatus(at('10:32'))
  assert.equal(status.kind, 'soon')
  assert.equal(status.bell.label, '2-я пара')
  assert.equal(status.countdown, 'через 8 мин')
  assert.equal(status.pause, 'Перемена')
})

test('before the first pair and on long breaks the status is "next"', () => {
  const morning = dayStatus(at('07:30'))
  assert.equal(morning.kind, 'next')
  assert.equal(morning.countdown, 'через 1 ч 30 мин')
  assert.equal(morning.pause, '')
})

test('after the last pair the widget points to the next school day, skipping Sunday', () => {
  const status = dayStatus(at('16:00', '2026-11-21')) // суббота
  assert.equal(status.kind, 'over')
  assert.equal(status.upcoming.key, '2026-11-23') // понедельник
  assert.equal(status.upcoming.bell.label, 'РОВ')
})

test('Sunday is a day off with the next school day', () => {
  const status = dayStatus(at('12:00', '2026-11-22'))
  assert.equal(status.kind, 'off')
  assert.equal(nextSchoolDay('2026-11-22').key, '2026-11-23')
})

test('minute boundaries: the pair is over exactly at its end time', () => {
  assert.equal(dayStatus(at('10:29')).kind, 'now')
  assert.equal(dayStatus(at('10:30')).kind, 'soon')
})
