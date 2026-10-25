import test from 'node:test'
import assert from 'node:assert/strict'
import { INTRO_BUTTON_AT, INTRO_CAPTIONS, INTRO_KEY, barHeight, buildBrain, cameraAt, captionAt, createBrainProjection, introMode, nodeReveal, projectBrain, shouldShowIntro } from './ai-intro.js'

test('intro is shown once: only until the seen mark is stored', () => {
  assert.equal(shouldShowIntro(() => null), true)
  assert.equal(shouldShowIntro((key) => (key === INTRO_KEY ? '1' : null)), false)
  assert.equal(shouldShowIntro(() => { throw new Error('storage blocked') }), true)
})

test('captions are in order, do not overlap and end when the button appears', () => {
  INTRO_CAPTIONS.forEach((item, index) => {
    assert.ok(item.to > item.from)
    if (index) assert.equal(item.from, INTRO_CAPTIONS[index - 1].to)
  })
  assert.equal(INTRO_CAPTIONS.at(-1).to, INTRO_BUTTON_AT)
})

test('caption fades in and out inside its own window', () => {
  assert.equal(captionAt(0.2), null)
  const first = INTRO_CAPTIONS[0]
  assert.equal(captionAt(first.from).opacity, 0)
  assert.equal(captionAt((first.from + first.to) / 2).opacity, 1)
  assert.ok(captionAt(first.to - 0.05).opacity < 0.5)
  assert.equal(captionAt(first.to).index, 1)
  assert.equal(captionAt(INTRO_BUTTON_AT + 1), null)
})

test('brain is deterministic, edges are valid and unique', () => {
  const brain = buildBrain(120)
  assert.deepEqual(brain, buildBrain(120))
  assert.equal(brain.nodes.length, 120)
  assert.ok(brain.edges.length > brain.nodes.length)
  const keys = new Set()
  for (const [a, b] of brain.edges) {
    assert.ok(a !== b && a >= 0 && b >= 0 && a < 120 && b < 120)
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    assert.ok(!keys.has(key)); keys.add(key)
  }
  brain.nodes.forEach((n, i) => assert.ok(brain.outgoing[i].length > 0 || Math.hypot(n.x, n.y, n.z) > 0, `node ${i} is isolated`))
  assert.ok(brain.nodes.every((n) => Math.hypot(n.x, n.y, n.z) <= 1.001))
})

test('projection is finite and rotation moves points', () => {
  const brain = buildBrain(80)
  const a = projectBrain(brain, { yaw: 0, pitch: 0 }, createBrainProjection(80))
  const b = projectBrain(brain, { yaw: 1.2, pitch: -0.3 }, createBrainProjection(80))
  for (const out of [a, b]) for (const key of ['sx', 'sy', 'scale', 'depth']) assert.ok([...out[key]].every(Number.isFinite))
  assert.notDeepEqual([...a.sx], [...b.sx])
  assert.ok([...a.depth].every((d) => d >= 0 && d <= 1))
})

test('camera approaches, bars slide in and neurons switch on one by one', () => {
  assert.ok(cameraAt(0).zoom < cameraAt(3).zoom && cameraAt(3).zoom < cameraAt(6).zoom)
  assert.equal(barHeight(0), 0)
  assert.ok(Math.abs(barHeight(5) - 0.1) < 1e-9)
  assert.equal(nodeReveal(0, 0.5), 0)
  assert.equal(nodeReveal(4, 0.5), 1)
  assert.ok(nodeReveal(0.5, 0) > 0 && nodeReveal(0.5, 0) < 1)
})

test('weak devices and reduced motion get a still frame', () => {
  assert.equal(introMode({ lite: false, reduced: false }), 'full')
  assert.equal(introMode({ lite: true, reduced: false }), 'still')
  assert.equal(introMode({ lite: false, reduced: true }), 'still')
})
