import test from 'node:test'
import assert from 'node:assert/strict'
import { FLAG_ORDER, isFlagRight, isUnityEasterEgg, nextStripe, unityCountdown } from './unity-fx.js'

test('countdown to 4 November splits into days, hours, minutes and seconds', () => {
  assert.deepEqual(unityCountdown(new Date(2026, 10, 3, 12, 30, 15)), { days: 0, hours: 11, minutes: 29, seconds: 45 })
  assert.deepEqual(unityCountdown(new Date(2026, 9, 31, 0, 0, 0)), { days: 4, hours: 0, minutes: 0, seconds: 0 })
  assert.equal(unityCountdown(new Date(2026, 10, 4, 0, 0, 0)), null, 'праздник наступил')
  assert.equal(unityCountdown(new Date(2026, 10, 20)), null, 'праздник прошёл')
})

test('flag game cycles stripe colours and knows the right order', () => {
  assert.deepEqual(FLAG_ORDER, ['white', 'blue', 'red'])
  assert.equal(nextStripe('white'), 'blue')
  assert.equal(nextStripe('blue'), 'red')
  assert.equal(nextStripe('red'), 'white')
  assert.equal(isFlagRight(['white', 'blue', 'red']), true)
  assert.equal(isFlagRight(['red', 'white', 'blue']), false)
})

test('search easter egg reacts to holiday words only', () => {
  for (const word of ['1612', ' Минин ', 'ПОЖАРСКИЙ', 'единство']) assert.equal(isUnityEasterEgg(word), true, word)
  for (const word of ['217', 'библиотека', '16120', '']) assert.equal(isUnityEasterEgg(word), false, word)
})
