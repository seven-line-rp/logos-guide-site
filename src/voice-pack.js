// Голосовые пакеты навигатора — заранее записанные фразы в стиле 2ГИС.
//
// У 2ГИС нет публичной веб-библиотеки озвучки (голосовые пакеты доступны
// только в приложении и нативном SDK), поэтому сайт приносит собственные
// пакеты: фиксированные манёвры лежат файлами в public/voice и играют через
// Web Audio API. Такая озвучка не зависит от системных голосов браузера и
// звучит одинаково на любом устройстве, включая машины без русского голоса.
//
// Пакетов два — женский и мужской; список фраз у них общий, отличаются
// только папки с файлами. Начало и прибытие имеют общие записанные фразы:
// на iPhone они звучат даже без русского системного голоса, а название
// кабинета остаётся на экране. Шаг маршрута несёт voiceCue со списком фраз;
// если запись не загрузилась, полную фразу пробует прочитать синтезатор.

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
let activeSources = []
let finishPlayback = null

function contextClass() {
  if (typeof window === 'undefined') return null
  return window.AudioContext || window.webkitAudioContext || null
}

// Safari создаёт AudioContext в состоянии suspended/interrupted. resume()
// вызываем СИНХРОННО внутри обработчика нажатия — после fetch/decode жест
// уже потерян. Не выдаём «played», если движок так и не перешёл в running.
export function primeVoicePack() {
  const Ctx = contextClass()
  if (!Ctx) return Promise.resolve(false)
  try {
    if (!audioContext || audioContext.state === 'closed') audioContext = new Ctx()
    if (!audioContext.state || audioContext.state === 'running') return Promise.resolve(true)
    if (typeof audioContext.resume !== 'function') return Promise.resolve(false)
    const resumed = audioContext.resume()
    // На iOS promise resume() может зависнуть, пока вкладка не станет активной.
    let timeout
    return Promise.race([
      Promise.resolve(resumed).then(() => audioContext.state === 'running', () => false),
      new Promise((resolve) => { timeout = window.setTimeout(() => resolve(false), 2500) }),
    ]).finally(() => window.clearTimeout?.(timeout))
  } catch { return Promise.resolve(false) }
}

function phraseUrl(key, dir) {
  if (!VOICE_PACK_PHRASES[key]) return null
  return `${import.meta.env?.BASE_URL || '/'}${dir}/${phraseFile(key)}`
}

async function loadBuffer(key, dir) {
  const cacheKey = `${dir}/${key}`
  if (bufferCache.has(cacheKey)) return bufferCache.get(cacheKey)
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
    return null
  }
}

export function stopVoicePack() {
  generation += 1
  finishPlayback?.('stopped')
  finishPlayback = null
  for (const source of activeSources) {
    try { source.stop() } catch { /* источник уже остановлен */ }
  }
  activeSources = []
}

// Играет последовательность фраз выбранного пакета ('female' | 'male') с
// короткими паузами. Возвращает 'played' только после запуска в running
// context; 'blocked' означает, что Safari не разблокировал звук этим жестом.
export async function playVoicePack(keys, { voice = 'female' } = {}) {
  stopVoicePack()
  const current = generation
  if (!Array.isArray(keys) || keys.length === 0) return 'empty'
  const dir = VOICE_PACKS[voice]?.dir
  if (!dir) return 'empty'

  // Важно: вызов primeVoicePack() идёт ДО первого await.
  const ready = primeVoicePack()
  if (!audioContext) return 'unavailable'
  const [unlocked, buffers] = await Promise.all([ready, Promise.all(keys.map((key) => loadBuffer(key, dir)))])
  if (current !== generation) return 'stopped'
  if (!unlocked || (audioContext.state && audioContext.state !== 'running')) return 'blocked'
  if (buffers.some((buffer) => !buffer)) return 'missing'

  let gain
  let cursor = audioContext.currentTime + 0.05
  try {
    gain = audioContext.createGain()
    gain.gain.value = 1
    gain.connect(audioContext.destination)
    for (const buffer of buffers) {
      const source = audioContext.createBufferSource()
      source.buffer = buffer
      source.connect(gain)
      source.start(cursor)
      activeSources.push(source)
      cursor += buffer.duration + PHRASE_GAP
    }
  } catch {
    for (const source of activeSources) { try { source.stop() } catch { /* ignore */ } }
    activeSources = []
    gain?.disconnect?.()
    return 'unavailable'
  }

  const lastSource = activeSources.at(-1)
  const total = cursor - PHRASE_GAP - audioContext.currentTime
  return new Promise((resolve) => {
    let finished = false
    let timeout
    const finish = (result) => {
      if (finished) return
      finished = true
      window.clearTimeout?.(timeout)
      lastSource.onended = null
      gain.disconnect?.()
      if (finishPlayback === finish) finishPlayback = null
      // Keep the sources until the next prompt: even if WebKit fired ended
      // early, stop() must still be able to silence them on replacement.
      resolve(result)
    }
    finishPlayback = finish
    lastSource.onended = () => finish(current === generation ? 'played' : 'stopped')
    // Старые WebKit иногда не посылают ended; не оставляем UI в ожидании.
    timeout = window.setTimeout(() => finish(current !== generation ? 'stopped' :
      audioContext.state && audioContext.state !== 'running' ? 'blocked' : 'played'),
    Math.max(1500, (total + 0.5) * 1000))
  })
}
