// Голосовой пакет навигатора — заранее записанные фразы в стиле 2ГИС.
//
// У 2ГИС нет публичной веб-библиотеки озвучки (голосовые пакеты доступны
// только в приложении и нативном SDK), поэтому сайт приносит собственный
// пакет: фиксированные манёвры лежат файлами в public/voice и играют через
// Web Audio API. Такая озвучка не зависит от системных голосов браузера и
// звучит одинаково на любом устройстве, включая машины без русского голоса.
//
// Названия кабинетов заранее записать нельзя — их по-прежнему читает
// браузерный синтез (speech.js). Шаг маршрута несёт voiceCue со списком
// фраз пакета; если хоть одна фраза не загрузилась, шаг целиком озвучивается
// синтезатором, чтобы подсказка не пропала.

export const VOICE_PACK_ID = 'pack2gis'

export const VOICE_PACK_PHRASES = {
  'route-built': { file: 'voice/route-built.mp3', text: 'Маршрут построен.' },
  'corridor-1-east': { file: 'voice/corridor-1-east.mp3', text: 'Идите по главному коридору в сторону холла, до нужной двери.' },
  'corridor-2-east': { file: 'voice/corridor-2-east.mp3', text: 'Идите по главному коридору в сторону лабораторий, до нужной двери.' },
  'corridor-1-west': { file: 'voice/corridor-1-west.mp3', text: 'Идите по главному коридору в сторону западного крыла, до нужной двери.' },
  'corridor-2-west': { file: 'voice/corridor-2-west.mp3', text: 'Идите по главному коридору в сторону библиотеки, до нужной двери.' },
  'west-corridor': { file: 'voice/west-corridor.mp3', text: 'Поверните в коридор западного крыла и идите вдоль кабинетов.' },
  'hall': { file: 'voice/hall.mp3', text: 'Пройдите через холл в сторону актового зала.' },
  'transfer-up': { file: 'voice/transfer-up.mp3', text: 'Поднимитесь на второй этаж.' },
  'transfer-down': { file: 'voice/transfer-down.mp3', text: 'Спуститесь на первый этаж.' },
  'arrive': { file: 'voice/arrive.mp3', text: 'Вы пришли на место.' },
}

const PHRASE_GAP = 0.26

let audioContext = null
let generation = 0
const bufferCache = new Map()
const unavailable = new Set()
let activeSources = []

function contextClass() {
  if (typeof window === 'undefined') return null
  return window.AudioContext || window.webkitAudioContext || null
}

// AudioContext можно создавать только после жеста пользователя: клик по
// кнопкам маршрута им и является, поэтому «прогрев» привязан к этим кликам.
export function primeVoicePack() {
  const Ctx = contextClass()
  if (!Ctx) return
  try {
    if (!audioContext) audioContext = new Ctx()
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => { })
  } catch { /* Web Audio недоступен — фразы озвучит синтезатор */ }
}

function phraseUrl(key) {
  const phrase = VOICE_PACK_PHRASES[key]
  if (!phrase) return null
  return `${import.meta.env.BASE_URL || '/'}${phrase.file}`
}

async function loadBuffer(key) {
  if (bufferCache.has(key)) return bufferCache.get(key)
  if (unavailable.has(key)) return null
  const url = phraseUrl(key)
  if (!url) return null
  try {
    const response = await fetch(url, { cache: 'force-cache' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.arrayBuffer()
    const buffer = await new Promise((resolve, reject) => {
      // Старые Safari требуют колбэчный вариант decodeAudioData.
      const maybePromise = audioContext.decodeAudioData(data, resolve, reject)
      if (maybePromise && typeof maybePromise.then === 'function') maybePromise.then(resolve, reject)
    })
    bufferCache.set(key, buffer)
    return buffer
  } catch {
    unavailable.add(key)
    return null
  }
}

export function voicePackKnownMissing(key) {
  return unavailable.has(key)
}

export function stopVoicePack() {
  generation += 1
  for (const source of activeSources) {
    try { source.stop() } catch { /* источник уже остановлен */ }
  }
  activeSources = []
}

// Играет последовательность фраз с короткими паузами. Возвращает 'played',
// если всё прозвучало; иначе причина, по которой вызывающий код должен
// озвучить шаг синтезатором.
export async function playVoicePack(keys) {
  if (!Array.isArray(keys) || keys.length === 0) return 'empty'
  primeVoicePack()
  if (!audioContext) return 'unavailable'
  const buffers = await Promise.all(keys.map(loadBuffer))
  if (buffers.some((buffer) => !buffer)) return 'missing'
  stopVoicePack()
  const current = generation
  const gain = audioContext.createGain()
  gain.gain.value = 1
  gain.connect(audioContext.destination)
  let cursor = audioContext.currentTime + 0.05
  for (const buffer of buffers) {
    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(gain)
    source.start(cursor)
    activeSources.push(source)
    cursor += buffer.duration + PHRASE_GAP
  }
  const total = cursor - PHRASE_GAP - audioContext.currentTime
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(current === generation ? 'played' : 'stopped'), Math.max(0, total + 0.15) * 1000)
  })
}
