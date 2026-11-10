import test from 'node:test'
import assert from 'node:assert/strict'
import { THEMES, cleanEnabledThemes, nextTheme, resolveTheme } from './theme.js'
import { holidayName } from './holidays.js'
import { bellsFor } from './bells.js'

test('the site has light, dark and pickme themes, and falls back to light', () => {
  assert.deepEqual(THEMES, ['light', 'dark', 'pickme'])
  assert.equal(resolveTheme('pickme'), 'pickme')
  assert.equal(resolveTheme('dark'), 'dark')
  assert.equal(resolveTheme('light'), 'light')
  assert.equal(resolveTheme(null), 'light')
  assert.equal(resolveTheme('sepia'), 'light')
  // Убранные темы у тех, кто их когда-то выбрал, становятся светлой.
  assert.equal(resolveTheme('motion'), 'light')
  assert.equal(resolveTheme('unity'), 'light')
})

test('the theme button cycles through the themes', () => {
  assert.equal(nextTheme('light'), 'dark')
  assert.equal(nextTheme('dark'), 'pickme')
  assert.equal(nextTheme('pickme'), 'light')
})

test('themes switched off in the admin panel disappear; light always stays', () => {
  assert.deepEqual(cleanEnabledThemes(['light', 'pickme']), ['light', 'pickme'])
  assert.deepEqual(cleanEnabledThemes(['dark']), ['light', 'dark'], 'светлую выключить нельзя')
  assert.deepEqual(cleanEnabledThemes([]), ['light'])
  assert.deepEqual(cleanEnabledThemes(['pickme', 'unity', 'dark']), ['light', 'dark', 'pickme'], 'неизвестные отброшены, порядок обычный')
  assert.deepEqual(cleanEnabledThemes(undefined), THEMES, 'сервер не ответил — все темы')
  assert.equal(resolveTheme('dark', ['light', 'pickme']), 'light', 'выбранную тему выключили — сайт светлый')
  assert.equal(nextTheme('light', ['light', 'pickme']), 'pickme')
  assert.equal(nextTheme('pickme', ['light', 'pickme']), 'light')
  assert.equal(nextTheme('light', ['light']), 'light')
})

test('public holidays have no bells, ordinary days do', () => {
  assert.equal(holidayName('2026-11-04'), 'День народного единства')
  assert.equal(holidayName('2026-11-05'), null)
  assert.deepEqual(bellsFor('2026-11-04').bells, [])
  assert.ok(bellsFor('2026-11-05').bells.length > 0)
})
