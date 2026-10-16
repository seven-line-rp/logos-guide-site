import test from 'node:test'
import assert from 'node:assert/strict'

// A suspended AudioContext is the normal first-tap state in iOS Safari.
// The resume call must happen before any asynchronous MP3 fetch/decode.
test('a phone tap resumes audio before loading recordings and finishes after playback', async () => {
  const oldWindow = globalThis.window
  const oldFetch = globalThis.fetch
  let resumeCalls = 0
  let fetchCalls = 0
  const sources = []
  class Context {
    state = 'suspended'
    currentTime = 0
    destination = {}
    resume() { resumeCalls += 1; this.state = 'running'; return Promise.resolve() }
    decodeAudioData(_bytes, resolve) { resolve({ duration: 0.3 }) }
    createGain() { return { gain: {}, connect() {}, disconnect() {} } }
    createBufferSource() {
      const source = { connect() {}, start() { sources.push(this) }, stop() {} }
      return source
    }
  }
  try {
    globalThis.window = { AudioContext: Context, setTimeout: () => 1, clearTimeout() {} }
    globalThis.fetch = async () => {
      fetchCalls += 1
      assert.equal(resumeCalls, 1, 'resume() must be called inside the click, before fetch()')
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) }
    }
    const { playVoicePack, stopVoicePack } = await import('./voice-pack.js?ios-running')
    const pending = playVoicePack(['route-built'])
    assert.equal(resumeCalls, 1, 'first call must synchronously unlock the context')
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(fetchCalls, 1)
    assert.equal(sources.length, 1)
    sources[0].onended()
    assert.equal(await pending, 'played')
    stopVoicePack()
  } finally {
    globalThis.window = oldWindow
    globalThis.fetch = oldFetch
  }
})

test('a blocked or interrupted iPhone context is reported, never called played', async () => {
  const oldWindow = globalThis.window
  const oldFetch = globalThis.fetch
  let started = false
  class BlockedContext {
    state = 'suspended'
    resume() { return Promise.reject(new Error('gesture not accepted')) }
    decodeAudioData(_bytes, resolve) { resolve({ duration: 0.3 }) }
    createGain() { return { gain: {}, connect() {} } }
    createBufferSource() { started = true; return { connect() {}, start() {} } }
  }
  try {
    globalThis.window = { AudioContext: BlockedContext, setTimeout: () => 1, clearTimeout() {} }
    globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })
    const { playVoicePack } = await import('./voice-pack.js?ios-blocked')
    assert.equal(await playVoicePack(['route-built']), 'blocked')
    assert.equal(started, false, 'never schedule a clip into a suspended context')
  } finally {
    globalThis.window = oldWindow
    globalThis.fetch = oldFetch
  }
})

test('a failed mobile download can be retried on the next tap', async () => {
  const oldWindow = globalThis.window
  const oldFetch = globalThis.fetch
  let requests = 0
  const sources = []
  class Context {
    currentTime = 0
    destination = {}
    decodeAudioData(_bytes, resolve) { resolve({ duration: 0.2 }) }
    createGain() { return { gain: {}, connect() {}, disconnect() {} } }
    createBufferSource() {
      const source = { connect() {}, start() { sources.push(this) }, stop() {} }
      return source
    }
  }
  try {
    globalThis.window = { AudioContext: Context, setTimeout: () => 1, clearTimeout() {} }
    globalThis.fetch = async () => ({ ok: ++requests > 1, arrayBuffer: async () => new ArrayBuffer(4) })
    const { playVoicePack } = await import('./voice-pack.js?mobile-retry')
    assert.equal(await playVoicePack(['route-built']), 'missing')
    const retry = playVoicePack(['route-built'])
    await new Promise((resolve) => setTimeout(resolve, 0))
    sources[0].onended()
    assert.equal(await retry, 'played')
    assert.equal(requests, 2)
  } finally {
    globalThis.window = oldWindow
    globalThis.fetch = oldFetch
  }
})
