import test from 'node:test'
import assert from 'node:assert/strict'
import { playVoicePack, stopVoicePack } from './voice-pack.js'
import { VOICE_PRESETS, getStoredPreset } from './speech.js'

test('only two Logos recordings are selectable and legacy choices migrate', () => {
  assert.deepEqual(VOICE_PRESETS.map(({ id }) => id), ['pack2gis', 'pack2gis-male'])
  const original = globalThis.localStorage
  try {
    for (const saved of ['female', 'navigator', 'sys:Irina', null]) {
      globalThis.localStorage = { getItem: () => saved }
      assert.equal(getStoredPreset(), 'pack2gis')
    }
    globalThis.localStorage = { getItem: () => 'pack2gis-male' }
    assert.equal(getStoredPreset(), 'pack2gis-male')
  } finally {
    if (original === undefined) delete globalThis.localStorage
    else globalThis.localStorage = original
  }
})

test('late recordings never restart after replacement or stop', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  const pending = []
  const sources = []
  class Context {
    currentTime = 0
    destination = {}
    decodeAudioData(_data, resolve) { resolve({ duration: 1 }) }
    createGain() { return { gain: {}, connect() {} } }
    createBufferSource() {
      const source = { started: false, stopped: false, connect() {}, start() { this.started = true }, stop() { this.stopped = true } }
      sources.push(source)
      return source
    }
  }
  try {
    globalThis.window = { AudioContext: Context, setTimeout: (fn) => { fn() } }
    globalThis.fetch = () => new Promise((resolve) => pending.push(() => resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) })))
    const old = playVoicePack(['route-built'])
    const latest = playVoicePack(['route-built'], { voice: 'male' })
    pending[1]()
    assert.equal(await latest, 'played')
    pending[0]()
    assert.equal(await old, 'stopped')
    assert.equal(sources.length, 1)
    const loading = playVoicePack(['hall'])
    assert.equal(sources[0].stopped, true, 'new prompt stops playing audio immediately')
    stopVoicePack()
    pending[2]()
    assert.equal(await loading, 'stopped')
    assert.equal(sources.length, 1)
  } finally {
    stopVoicePack()
    globalThis.fetch = originalFetch
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})
