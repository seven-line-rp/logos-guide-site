import test from 'node:test'
import assert from 'node:assert/strict'
import { CONSENT_KEY, functionalStorageAllowed, parseConsent, readConsent, saveConsent } from './consent.js'
import { storedItems } from './pages/privacy-items.js'

function fakeStorage(initial = {}) {
  const data = { ...initial }
  return {
    get length() { return Object.keys(data).length },
    key: (index) => Object.keys(data)[index] ?? null,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value) },
    removeItem: (key) => { delete data[key] },
    dump: () => ({ ...data }),
  }
}

test('without an answer the site keeps remembering settings', () => {
  const storage = fakeStorage()
  assert.equal(readConsent(storage), null)
  assert.equal(functionalStorageAllowed(storage), true)
})

test('accepting keeps saved settings', () => {
  const storage = fakeStorage({ 'site-theme': 'dark' })
  saveConsent(true, storage, new Date('2026-10-18T10:00:00Z'))
  assert.deepEqual(readConsent(storage), { functional: true, at: '2026-10-18T10:00:00.000Z' })
  assert.equal(storage.getItem('site-theme'), 'dark')
  assert.equal(functionalStorageAllowed(storage), true)
})

test('declining wipes saved settings and blocks new ones', () => {
  const storage = fakeStorage({ 'site-theme': 'dark', 'game-quiz-best': '5', 'logos-tour-done': 'x' })
  saveConsent(false, storage)
  assert.deepEqual(Object.keys(storage.dump()), [CONSENT_KEY])
  assert.equal(functionalStorageAllowed(storage), false)
})

test('broken or outdated answers are asked again', () => {
  for (const raw of ['', 'nope', '{}', '{"v":0,"functional":true}', '{"v":1,"functional":"yes"}']) assert.equal(parseConsent(raw), null, raw)
})

test('the privacy policy lists every key the site stores', () => {
  const listed = storedItems.flatMap((item) => item.key.split(', '))
  for (const key of [CONSENT_KEY, 'site-theme', 'site-language', 'map-show-labels', 'map-show-doors', 'map-manual-point', 'map-gps-anchors', 'route-voice', 'route-voice-preset', 'route-voice-name', 'game-quiz-best', 'game-speed-best', 'logos-tour-done', 'logos-favorites', 'logos-recent-routes']) {
    assert.ok(listed.includes(key), key)
  }
})
