import test from 'node:test'
import assert from 'node:assert/strict'
import { TOUR_STEPS, TOUR_TONES, TUTORIAL_STORAGE_KEY, markTutorialDone, readTutorialDone, tourStepIds } from './tutorial.js'

function fakeStorage(initial = {}) {
  const data = { ...initial }
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value) },
    removeItem: (key) => { delete data[key] },
  }
}

test('every tour step is complete and points at a real page', () => {
  const ids = tourStepIds()
  assert.equal(new Set(ids).size, ids.length, 'step ids are unique')
  assert.ok(ids.length >= 8, 'the tour covers the whole site')
  assert.equal(ids[0], 'intro')
  assert.equal(ids.at(-1), 'docs')
  for (const step of TOUR_STEPS) {
    assert.match(step.to, /^\/(map|rooms|route|games|services|about|docs)?$/, step.id)
    assert.ok(step.title.length > 3, step.id)
    assert.ok(step.text.length > 20, step.id)
    assert.ok(step.eyebrow.length > 0, step.id)
    assert.ok(step.action.length > 0, step.id)
    assert.ok(TOUR_TONES.includes(step.tone), `${step.id}: tone ${step.tone}`)
    assert.ok(step.icon.length > 0, step.id)
    assert.ok(Array.isArray(step.targets), step.id)
    // Каждый селектор — простой CSS-селектор, а не произвольный код.
    for (const selector of step.targets) assert.match(selector, /^[.#][\w-]+$/, `${step.id}: ${selector}`)
  }
})

test('neighbouring steps never share a colour', () => {
  for (let index = 1; index < TOUR_STEPS.length; index += 1) {
    assert.notEqual(TOUR_STEPS[index].tone, TOUR_STEPS[index - 1].tone, TOUR_STEPS[index].id)
  }
})

test('the tour no longer mentions the removed AI assistant', () => {
  for (const step of TOUR_STEPS) {
    assert.doesNotMatch(`${step.title} ${step.text}`, /LOGOS AI|помощник|Туторил/i, step.id)
    assert.ok(!step.targets.some((selector) => selector.includes('assistant')), step.id)
  }
})

test('the documentation step falls back to the menu button on small screens', () => {
  const docsStep = TOUR_STEPS.find((step) => step.id === 'docs')
  assert.deepEqual(docsStep.targets, ['.header-docs', '.mobile-menu-toggle'])
})

test('finishing the tour is remembered in the browser', () => {
  const storage = fakeStorage()
  assert.equal(readTutorialDone(storage), false)
  globalThis.localStorage = storage
  markTutorialDone()
  delete globalThis.localStorage
  assert.equal(readTutorialDone(storage), true)
  assert.ok(storage.getItem(TUTORIAL_STORAGE_KEY).length > 0)
  assert.equal(readTutorialDone(null), false, 'works without any storage')
})
