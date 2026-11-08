import test from 'node:test'
import assert from 'node:assert/strict'
import { THEMES, nextTheme, resolveTheme } from './theme.js'
import { holidayName } from './holidays.js'
import { daysToUnity } from './festive.js'
import { bellsFor } from './schedule.js'

test('the site has light, dark, pickme, motion and unity themes, and falls back to light', () => {
  assert.deepEqual(THEMES, ['light', 'dark', 'pickme', 'motion', 'unity'])
  assert.equal(resolveTheme('pickme'), 'pickme')
  assert.equal(resolveTheme('motion'), 'motion')
  assert.equal(resolveTheme('dark'), 'dark')
  assert.equal(resolveTheme('light'), 'light')
  assert.equal(resolveTheme('unity'), 'unity')
  assert.equal(resolveTheme(null), 'light')
  assert.equal(resolveTheme('sepia'), 'light')
})

test('the theme button cycles through all five themes', () => {
  assert.equal(nextTheme('light'), 'dark')
  assert.equal(nextTheme('dark'), 'pickme')
  assert.equal(nextTheme('pickme'), 'motion')
  assert.equal(nextTheme('motion'), 'unity')
  assert.equal(nextTheme('unity'), 'light')
})

test('unity countdown counts days to 4 November', () => {
  assert.equal(daysToUnity(new Date(2026, 10, 3, 15)), 1)
  assert.equal(daysToUnity(new Date(2026, 10, 4, 9)), 0)
  assert.equal(daysToUnity(new Date(2026, 10, 5, 9)), -1)
  assert.equal(daysToUnity(new Date(2026, 9, 25, 9)), 10)
})

test('public holidays have no bells, ordinary days do', () => {
  assert.equal(holidayName('2026-11-04'), 'День народного единства')
  assert.equal(holidayName('2026-11-05'), null)
  assert.deepEqual(bellsFor('2026-11-04').bells, [])
  assert.ok(bellsFor('2026-11-05').bells.length > 0)
})
