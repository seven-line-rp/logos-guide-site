import test from 'node:test'
import assert from 'node:assert/strict'
import { THEMES, nextTheme, resolveTheme } from './theme.js'
import { holidayName } from './holidays.js'
import { bellsFor } from './schedule.js'

test('the site has a light and a dark theme, and falls back to light', () => {
  assert.deepEqual(THEMES, ['light', 'dark'])
  assert.equal(resolveTheme('dark'), 'dark')
  assert.equal(resolveTheme('light'), 'light')
  assert.equal(resolveTheme(null), 'light')
  assert.equal(resolveTheme('unity'), 'light', 'старое значение темы «Единство» уходит в светлую')
})

test('the theme button switches between the two themes', () => {
  assert.equal(nextTheme('light'), 'dark')
  assert.equal(nextTheme('dark'), 'light')
})

test('public holidays have no bells, ordinary days do', () => {
  assert.equal(holidayName('2026-11-04'), 'День народного единства')
  assert.equal(holidayName('2026-11-05'), null)
  assert.deepEqual(bellsFor('2026-11-04').bells, [])
  assert.ok(bellsFor('2026-11-05').bells.length > 0)
})
