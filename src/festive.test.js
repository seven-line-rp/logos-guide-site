import test from 'node:test'
import assert from 'node:assert/strict'
import { daysToUnity, festiveActive, inUnityWindow } from './festive.js'
import { holidayName } from './holidays.js'
import { bellsFor } from './schedule.js'

const day = (text) => new Date(`${text}T12:00:00`)

test('the festive window opens a week before 4 November and closes after it', () => {
  assert.equal(daysToUnity(day('2026-11-04')), 0)
  assert.equal(daysToUnity(day('2026-11-01')), 3)
  assert.equal(inUnityWindow(day('2026-10-27')), false)
  assert.equal(inUnityWindow(day('2026-10-28')), true)
  assert.equal(inUnityWindow(day('2026-11-04')), true)
  assert.equal(inUnityWindow(day('2026-11-05')), false)
  assert.equal(inUnityWindow(day('2026-03-10')), false)
})

test('a saved choice beats the date', () => {
  assert.equal(festiveActive(day('2026-03-10'), 'on'), true)
  assert.equal(festiveActive(day('2026-11-02'), 'off'), false)
  assert.equal(festiveActive(day('2026-11-02'), null), true)
})

test('public holidays have no bells, ordinary days do', () => {
  assert.equal(holidayName('2026-11-04'), 'День народного единства')
  assert.equal(holidayName('2026-11-05'), null)
  assert.deepEqual(bellsFor('2026-11-04').bells, [])
  assert.ok(bellsFor('2026-11-05').bells.length > 0)
})
