import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareSpeechText, pickVoice, speakText, stopSpeech } from './speech.js'

test('speech text is cleaned up before it reaches the browser voice', () => {
  assert.equal(prepareSpeechText('Вы пришли: Кабинет физики №211.'), 'Вы пришли: Кабинет физики № 211.')
  assert.equal(prepareSpeechText('Лаборатория  БПЛА'), 'Лаборатория беспилотников')
  assert.equal(prepareSpeechText('   '), '')
  assert.equal(prepareSpeechText(null), '')
})

test('speech helpers stay quiet when the browser has no synthesis', async () => {
  // Node has no window: the module must not throw, it just does nothing.
  assert.equal(await speakText('Проверка'), 'unsupported')
  assert.equal(pickVoice(), null)
  assert.doesNotThrow(() => stopSpeech())
})

// Дальше проверяем поведение с поддельным Web Speech API: настоящая причина
// «озвучки не слышно» — пустой список голосов и очередь, которая не
// разблокируется, пока говорит предыдущая фраза.
function fakeBrowser(voices) {
  const spoken = []
  const synth = {
    spoken,
    cancelled: 0,
    speaking: false,
    paused: false,
    getVoices: () => voices,
    addEventListener: () => { },
    removeEventListener: () => { },
    speak(utterance) {
      spoken.push(utterance)
      utterance.onend?.()
    },
    cancel() { this.cancelled += 1 },
    resume() { this.paused = false },
  }
  class Utterance {
    constructor(text) { this.text = text }
  }
  globalThis.window = {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: Utterance,
    setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 0 },
  }
  return { synth, spoken }
}

test('the chosen voice is a Russian system voice, not an English or espeak one', async () => {
  const { synth, spoken } = fakeBrowser([
    { name: 'espeak', lang: 'ru-RU', localService: true, default: false },
    { name: 'Daniel', lang: 'en-GB', localService: true, default: true },
    { name: 'Google русский', lang: 'ru-RU', localService: false, default: false },
    { name: 'Microsoft Irina', lang: 'ru-RU', localService: true, default: false },
    { name: 'Microsoft Pavel', lang: 'ru-RU', localService: true, default: false },
  ])
  assert.equal(await speakText('Начинаем движение от: Актовый зал № 104.', { preset: 'female' }), 'ok')
  assert.equal(spoken.length, 1)
  assert.equal(spoken[0].voice.name, 'Microsoft Irina')
  assert.equal(spoken[0].voice.lang, 'ru-RU')
  assert.ok(!/espeak/.test(spoken[0].voice.name), 'espeak звучит роботом, его выбираем последним')
  assert.equal(spoken[0].lang, 'ru-RU', 'без lang браузер читает русский текст английскими правилами')
  assert.equal(spoken[0].text, 'Начинаем движение от: Актовый зал № 104.')
  assert.equal(synth.cancelled, 1, 'предыдущая фраза отменяется, иначе очередь залипает')

  // Test male preset
  assert.equal(await speakText('Поверните направо.', { preset: 'male' }), 'ok')
  assert.equal(spoken.length, 2)
  assert.equal(spoken[1].voice.name, 'Microsoft Pavel')

  delete globalThis.window
})

test('a browser without a Russian voice reports it instead of staying silent', async () => {
  fakeBrowser([{ name: 'Daniel', lang: 'en-GB', localService: true, default: true }])
  assert.equal(await speakText('Начало маршрута.'), 'foreign-voice', 'страница покажет подсказку про настройки системы')
  delete globalThis.window
})
