// Озвучка подсказок на странице маршрута через Web Speech API.
//
// Браузерный синтез здесь «сырой», поэтому модуль решает три типичные беды:
//   1. На Android и в Chrome первые вызовы speak() молча пропадают, пока
//      список голосов ещё пустой — поэтому голос выбираем явно и будим движок.
//   2. Browser voices читают цифры как «104» посреди русского текста не так,
//      как нужно: чистим текст (кириллица вместо латиницы, развёрнутые номера
//      кабинетов, пауза после «№»).
//   3. Пока говорит предыдущая фраза, новая не стартует — отменяем её и ждём
//      события end, иначе половина шагов остаётся без звука.

const VOICE_KEY = 'route-voice-name'

let voicesCache = []
let warmedUp = false
let finishCurrent = null

function supported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'
}

// Голоса подгружаются асинхронно: до события voiceschanged список пуст.
export function loadVoices() {
  if (!supported()) return Promise.resolve([])
  const collected = window.speechSynthesis.getVoices() || []
  if (collected.length) {
    voicesCache = collected
    return Promise.resolve(collected)
  }
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.speechSynthesis.removeEventListener?.('voiceschanged', onChange)
      voicesCache = window.speechSynthesis.getVoices() || []
      resolve(voicesCache)
    }
    function onChange() { finish() }
    window.speechSynthesis.addEventListener?.('voiceschanged', onChange)
    window.setTimeout(finish, 1500)
  })
}

function score(voice) {
  const name = `${voice.name} ${voice.voiceURI}`.toLowerCase()
  const lang = (voice.lang || '').toLowerCase().replace('_', '-')
  let value = 0
  if (lang.startsWith('ru')) value += 100
  else if (lang.startsWith('en')) value += 12
  // Системные голоса «из коробки» звучат ровнее и всегда доступны офлайн.
  if (/google/.test(name)) value += 26
  if (/yandex|alena|alena|milena|katya|dariya|svetlana|pavel/.test(name)) value += 22
  if (/microsoft|aria|irina|dmitry|svetlana/.test(name)) value += 20
  if (/apple|milena|yuri/.test(name)) value += 18
  if (voice.localService) value += 20
  if (voice.default) value += 8
  if (/espeak|espeak-ng|festival/.test(name)) value -= 40
  return value
}

// «Базовый ИИ-шный» голос: русский системный синтез, ровный темп, средняя высота.
export function pickVoice() {
  if (!voicesCache.length) return null
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(VOICE_KEY) : null
  if (saved) {
    const match = voicesCache.find((voice) => voice.name === saved)
    if (match) return match
  }
  return [...voicesCache].sort((first, second) => score(second) - score(first))[0] || null
}

// Разбудить синтезатор: тихая фраза снимает блокировку первых вызовов.
export function primeSpeech() {
  if (!supported() || warmedUp) return
  warmedUp = true
  loadVoices().then(() => {
    const warmup = new window.SpeechSynthesisUtterance(' ')
    warmup.volume = 0
    warmup.lang = 'ru-RU'
    warmup.onend = () => { }
    // До первого касания экрана Safari может отклонить вызов — это не ошибка.
    try { window.speechSynthesis.speak(warmup) } catch { /* ждём жеста пользователя */ }
  }).catch(() => { /* голосов нет — озвучка просто не включится */ })
}

export function stopSpeech() {
  if (!supported()) return
  window.speechSynthesis.cancel()
  finishCurrent = null
}

// \b в JavaScript знает только латиницу, поэтому границы слова собираем сами.
const wholeWord = (pattern, replacement) => (text) => text.replace(
  new RegExp(`(^|[^A-Za-zА-Яа-яЁё0-9])(${pattern})(?![A-Za-zА-Яа-яЁё0-9])`, 'g'),
  `$1${replacement}`,
)

export function prepareSpeechText(text) {
  let phrase = String(text ?? '')
    // Цифры после «№» браузер иногда читает побуквенно — ставим разделитель.
    .replace(/№\s*/g, '№ ')
  // Аббревиатуры и латиница в русской фразе читаются по буквам.
  phrase = wholeWord('БПЛА', 'беспилотников')(phrase)
  phrase = wholeWord('МК-?1', 'эм ка один')(phrase)
  phrase = wholeWord('SOS', 'эс о эс')(phrase)
  return phrase.replace(/\s{2,}/g, ' ').trim()
}

function speakOnce(text, voice, rate) {
  const utterance = new window.SpeechSynthesisUtterance(text)
  utterance.lang = (voice?.lang || 'ru-RU').replace('_', '-')
  utterance.rate = rate
  utterance.pitch = 1
  utterance.volume = 1
  if (voice) {
    utterance.voice = voice
    try { utterance.lang = voice.lang || utterance.lang } catch { /* старый Safari */ }
  }
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      if (finishCurrent === finish) finishCurrent = null
      resolve()
    }
    utterance.onend = finish
    utterance.onerror = finish
    // Страховка: некоторые движки не присылают end, и очередь «залипает».
    const guard = Math.max(4000, text.length * 130)
    window.setTimeout(finish, guard)
    finishCurrent = finish
    try {
      window.speechSynthesis.speak(utterance)
    } catch {
      finish()
    }
  })
}

export function hasRussianVoice() {
  return voicesCache.some((voice) => (voice.lang || '').toLowerCase().startsWith('ru'))
}

// Возвращаем код, а не boolean: странице нужно объяснить пользователю, почему
// тишина (нет русского голоса в системе / браузер не умеет синтез).
export async function speakText(text, { rate = 1 } = {}) {
  if (!supported()) return 'unsupported'
  const phrase = prepareSpeechText(text)
  if (!phrase) return 'empty'
  const synth = window.speechSynthesis
  synth.cancel()
  finishCurrent?.()
  // Список голосов мог догрузиться позже (Chrome отдаёт его после
  // voiceschanged), поэтому каждый раз спрашиваем браузер заново.
  const fresh = synth.getVoices?.() || []
  const voices = fresh.length ? fresh : voicesCache.length ? voicesCache : await loadVoices()
  voicesCache = voices
  const voice = pickVoice()
  const russian = Boolean(voice && (voice.lang || '').toLowerCase().startsWith('ru'))
  await speakOnce(phrase, voice, rate)
  // Хром с длинными фразами иногда ставит очередь на паузу сразу после старта.
  window.setTimeout(() => { try { if (synth.speaking && synth.paused) synth.resume() } catch { /* ignore */ } }, 220)
  if (!voice) return 'no-voice'
  return russian ? 'ok' : 'foreign-voice'
}

export function rememberVoice(name) {
  try { localStorage.setItem(VOICE_KEY, name) } catch { /* приватный режим */ }
}
