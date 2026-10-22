import test from 'node:test'
import assert from 'node:assert/strict'
import { averageFrameMs, isSlowFrames, isWeakDevice } from './perf.js'

test('слабое устройство: мало памяти, ядер или экономия трафика', () => {
  assert.equal(isWeakDevice({ memory: 2, cores: 8 }), true)
  assert.equal(isWeakDevice({ memory: 8, cores: 2 }), true)
  assert.equal(isWeakDevice({ memory: 8, cores: 8, saveData: true }), true)
  assert.equal(isWeakDevice({ memory: 8, cores: 8 }), false)
  assert.equal(isWeakDevice({}), false)
})

test('замер кадров: медленные кадры включают лёгкий режим', () => {
  const at = (step, count) => Array.from({ length: count }, (_, i) => i * step)
  assert.equal(averageFrameMs(at(50, 21)), 50)
  assert.equal(isSlowFrames(at(50, 40)), true)
  assert.equal(isSlowFrames(at(16, 120)), false)
  assert.equal(isSlowFrames(at(80, 5)), false)
})
