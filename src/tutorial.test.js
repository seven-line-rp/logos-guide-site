import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TOUR_STEPS, TUTORIAL_COMMAND, TUTORIAL_STORAGE_KEY, isTutorialCommand, markTutorialDone,
  normalizeCommand, readTutorialDone, tourStepIds,
} from './tutorial.js'

function fakeStorage(initial = {}) {
  const data = { ...initial }
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value) },
    removeItem: (key) => { delete data[key] },
  }
}

test('the key command is recognised in any case, layout and wording', () => {
  assert.equal(TUTORIAL_COMMAND, 'Туторил')
  for (const variant of ['Туторил', 'туторил', 'ТУТОРИЛ', 'Туторил!', 'туторил?', ' Туторил ', 'туториал', 'tutorial', 'обучение', 'как работает сайт', 'Покажи как работает сайт']) {
    assert.equal(isTutorialCommand(variant), true, variant)
  }
  // «Туторил», набранное в английской раскладке.
  assert.equal(isTutorialCommand('Nenjhbd'), true)
})

test('ordinary questions are not treated as the tour command', () => {
  for (const text of ['', '   ', 'Где находится библиотека?', 'расскажи про обучение в колледже', 'что такое туторил?', 'построй маршрут', 'null', 42, null, undefined]) {
    assert.equal(isTutorialCommand(text), false, String(text))
  }
  assert.equal(normalizeCommand('  ТуТОРИЛ!!  '), 'туторил')
  assert.equal(normalizeCommand(null), '')
})

test('every tour step is complete and points at a real page', () => {
  const ids = tourStepIds()
  assert.equal(new Set(ids).size, ids.length, 'step ids are unique')
  assert.ok(ids.length >= 8, 'the tour covers the whole site')
  assert.equal(ids[0], 'intro')
  assert.equal(ids.at(-1), 'assistant')
  for (const step of TOUR_STEPS) {
    assert.match(step.to, /^\/(map|rooms|route|games|services|about)?$/, step.id)
    assert.ok(step.title.length > 3, step.id)
    assert.ok(step.text.length > 20, step.id)
    assert.ok(step.eyebrow.length > 0, step.id)
    assert.ok(step.action.length > 0, step.id)
    assert.ok(Array.isArray(step.targets), step.id)
    // Каждый селектор — простой CSS-селектор, а не произвольный код.
    for (const selector of step.targets) assert.match(selector, /^[.#][\w-]+$/, `${step.id}: ${selector}`)
  }
})

test('the tour highlight falls back to another element on small screens', () => {
  const assistantStep = TOUR_STEPS.find((step) => step.id === 'assistant')
  assert.deepEqual(assistantStep.targets, ['.assistant-launcher', '.header-assistant'])
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
