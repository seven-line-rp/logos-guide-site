// Голосовые пакеты навигатора — заранее записанные фразы в стиле 2ГИС.
//
// У 2ГИС нет публичной веб-библиотеки озвучки (голосовые пакеты доступны
// только в приложении и нативном SDK), поэтому сайт приносит собственные
// пакеты: фиксированные манёвры лежат файлами в public/voice и играют через
// Web Audio API. Такая озвучка не зависит от системных голосов браузера и
// звучит одинаково на любом устройстве, включая машины без русского голоса.
//
// Пакетов два — женский и мужской; список фраз у них общий, отличаются
// только папки с файлами. Названия кабинетов заранее записать нельзя — их
// по-прежнему читает браузерный синтез (speech.js). Шаг маршрута несёт
// voiceCue со списком фраз; если хоть одна фраза не загрузилась, шаг целиком
// озвучивается синтезатором, чтобы подсказка не пропала.

export const VOICE_PACK_ID = 'pack2gis'
export const VOICE_PACK_MALE_ID = 'pack2gis-male'

export const VOICE_PACKS = {
  female: { presetId: VOICE_PACK_ID, label: 'Женская запись', dir: 'voice' },
  male: { presetId: VOICE_PACK_MALE_ID, label: 'Мужская запись', dir: 'voice/male' },
}

export function voicePackForPreset(presetId) {
  return Object.values(VOICE_PACKS).find((pack) => pack.presetId === presetId) || null
}

export const VOICE_PACK_PHRASES = {
  'route-built': { text: 'Маршрут построен.' },
  'corridor-1-east': { text: 'Идите по главному коридору в сторону холла, до нужной двери.' },
  'corridor-2-east': { text: 'Идите по главному коридору в сторону лабораторий, до нужной двери.' },
  'corridor-1-west': { text: 'Идите по главному коридору в сторону западного крыла, до нужной двери.' },
  'corridor-2-west': { text: 'Идите по главному коридору в сторону библиотеки, до нужной двери.' },
  'west-corridor': { text: 'Поверните в коридор западного крыла и идите вдоль кабинетов.' },
  'hall': { text: 'Пройдите через холл в сторону актового зала.' },
  'transfer-up': { text: 'Поднимитесь на второй этаж.' },
  'transfer-down': { text: 'Спуститесь на первый этаж.' },
  'arrive': { text: 'Вы пришли на место.' },
}

// Имя файла каждой фразы — её ключ.
const phraseFile = (key) => `${key}.mp3`

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

function phraseUrl(key, dir) {
  if (!VOICE_PACK_PHRASES[key]) return null
  return `${import.meta.env?.BASE_URL || '/'}${dir}/${phraseFile(key)}`
}

async function loadBuffer(key, dir) {
  const cacheKey = `${dir}/${key}`
  if (bufferCache.has(cacheKey)) return bufferCache.get(cacheKey)
  if (unavailable.has(cacheKey)) return null
  const url = phraseUrl(key, dir)
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
    bufferCache.set(cacheKey, buffer)
    return buffer
  } catch {
    unavailable.add(cacheKey)
    return null
  }
}

export function stopVoicePack() {
  generation += 1
  for (const source of activeSources) {
    try { source.stop() } catch { /* источник уже остановлен */ }
  }
  activeSources = []
}

// Играет последовательность фраз выбранного пакета ('female' | 'male') с
// короткими паузами. Возвращает 'played', если всё прозвучало; иначе причина,
// по которой вызывающий код должен озвучить шаг синтезатором.
export async function playVoicePack(keys, { voice = 'female' } = {}) {
  stopVoicePack()
  const current = generation
  if (!Array.isArray(keys) || keys.length === 0) return 'empty'
  primeVoicePack()
  if (!audioContext) return 'unavailable'
  const dir = VOICE_PACKS[voice]?.dir
  if (!dir) return 'empty'
  const buffers = await Promise.all(keys.map((key) => loadBuffer(key, dir)))
  if (current !== generation) return 'stopped'
  if (buffers.some((buffer) => !buffer)) return 'missing'
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
