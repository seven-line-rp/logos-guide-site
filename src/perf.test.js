import test from 'node:test'
import assert from 'node:assert/strict'
import { averageFrameMs, canRunScene3d, isSlowFrames, isWeakDevice } from './perf.js'

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

test('слабый Android: до 4 ГБ памяти — лёгкий режим, на других устройствах порог 2 ГБ', () => {
  assert.equal(isWeakDevice({ memory: 4, cores: 8, android: true }), true)
  assert.equal(isWeakDevice({ memory: 4, cores: 8 }), false)
  assert.equal(isWeakDevice({ memory: 8, cores: 8, android: true }), false)
})

test('3D-сцена только на мощном компьютере с мышью', () => {
  const desktop = { lite: false, reduced: false, coarse: false, narrow: false, memory: 8, cores: 8 }
  assert.equal(canRunScene3d(desktop), true)
  assert.equal(canRunScene3d({}), true, 'без данных о железе считаем, что тянет')
  assert.equal(canRunScene3d({ ...desktop, coarse: true }), false, 'телефон и планшет с касанием')
  assert.equal(canRunScene3d({ ...desktop, narrow: true }), false, 'узкое окно')
  assert.equal(canRunScene3d({ ...desktop, lite: true }), false, 'режим «Лёгкий»')
  assert.equal(canRunScene3d({ ...desktop, reduced: true }), false, '«Уменьшить движение»')
  assert.equal(canRunScene3d({ ...desktop, memory: 2 }), false)
  assert.equal(canRunScene3d({ ...desktop, cores: 2 }), false)
})
