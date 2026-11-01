import test from 'node:test'
import assert from 'node:assert/strict'
import { daysToUnity, inUnityWindow } from './festive.js'
import { THEMES, nextTheme, resolveTheme } from './theme.js'
import { holidayName } from './holidays.js'
import { bellsFor } from './schedule.js'

const day = (text) => new Date(`${text}T12:00:00`)

test('the festive week opens seven days before 4 November and closes after it', () => {
  assert.equal(daysToUnity(day('2026-11-04')), 0)
  assert.equal(daysToUnity(day('2026-11-01')), 3)
  assert.equal(inUnityWindow(day('2026-10-27')), false)
  assert.equal(inUnityWindow(day('2026-10-28')), true)
  assert.equal(inUnityWindow(day('2026-11-04')), true)
  assert.equal(inUnityWindow(day('2026-11-05')), false)
  assert.equal(inUnityWindow(day('2026-03-10')), false)
})

test('a chosen theme wins; without a choice the festive week opens the Unity theme', () => {
  assert.equal(resolveTheme('dark', day('2026-11-02')), 'dark')
  assert.equal(resolveTheme('light', day('2026-11-02')), 'light')
  assert.equal(resolveTheme('unity', day('2026-03-10')), 'unity')
  assert.equal(resolveTheme(null, day('2026-11-02')), 'unity')
  assert.equal(resolveTheme('rainbow', day('2026-03-10')), 'light')
  assert.equal(resolveTheme(null, day('2026-03-10')), 'light')
})

test('the theme button cycles through every theme', () => {
  assert.deepEqual(THEMES.map((theme) => nextTheme(theme)), ['dark', 'unity', 'light'])
})

test('public holidays have no bells, ordinary days do', () => {
  assert.equal(holidayName('2026-11-04'), 'День народного единства')
  assert.equal(holidayName('2026-11-05'), null)
  assert.deepEqual(bellsFor('2026-11-04').bells, [])
  assert.ok(bellsFor('2026-11-05').bells.length > 0)
})
