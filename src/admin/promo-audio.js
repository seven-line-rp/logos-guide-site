// Звук промо-ролика в браузере: голос (синтезированный или свой, записанный во
// вкладке), музыка, которая приседает под голос, и сборка ролика для скачивания.
// Всё работает на Web Audio API, без сервера.

export const SAMPLE_RATE = 44100

export async function loadBuffer(context, url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Не удалось загрузить ${url}`)
  return context.decodeAudioData(await response.arrayBuffer())
}

// Первая и последняя заметно громкие точки записи: тишину по краям отрезаем.
function trimBounds(data, rate) {
  const threshold = .02
  let first = 0
  while (first < data.length && Math.abs(data[first]) < threshold) first += 1
  let last = data.length - 1
  while (last > first && Math.abs(data[last]) < threshold) last -= 1
  const pad = Math.round(rate * .04)
  return [Math.max(0, first - pad), Math.min(data.length, last + pad)]
}

// Своя дорожка голоса: каждая записанная фраза ставится в начало своего места
// в ролике. Возвращает буфер и фразы, которые длиннее своего места.
export function assembleTakes(context, takes, timeline) {
  const rate = context.sampleRate
  const out = context.createBuffer(1, Math.ceil(timeline.duration * rate), rate)
  const channel = out.getChannelData(0)
  const tooLong = []
  timeline.lines.forEach((line, index) => {
    const take = takes[line.id]
    if (!take) return
    const data = take.getChannelData(0)
    const [from, to] = trimBounds(data, take.sampleRate)
    const ratio = take.sampleRate / rate
    const length = Math.floor((to - from) / ratio)
    const start = Math.round(line.start * rate)
    const slotEnd = index < timeline.lines.length - 1 ? timeline.lines[index + 1].start : timeline.duration
    const over = (length / rate) - (slotEnd - line.start - .15)
    if (over > .05) tooLong.push({ id: line.id, over })
    for (let i = 0; i < length && start + i < channel.length; i += 1) channel[start + i] += data[from + Math.floor(i * ratio)]
  })
  return { buffer: out, tooLong }
}

// Насколько приглушить музыку в каждый момент: громкость голоса окнами по 50 мс.
export function duckCurve(voice, duration, depth = .62) {
  const step = .05
  const points = Math.ceil(duration / step)
  const curve = new Float32Array(points).fill(1)
  if (!voice) return curve
  const data = voice.getChannelData(0)
  const size = Math.round(voice.sampleRate * step)
  let level = 0
  for (let i = 0; i < points; i += 1) {
    let sum = 0
    for (let j = i * size; j < Math.min(data.length, (i + 1) * size); j += 1) sum += data[j] * data[j]
    const rms = Math.sqrt(sum / size)
    const target = Math.min(1, rms / .04)
    level = target > level ? level + (target - level) * .6 : level + (target - level) * .12 // быстро вниз, плавно назад
    curve[i] = 1 - depth * level
  }
  return curve
}

// Граф: голос -> обработка -> выход, музыка -> громкость с приседанием -> выход.
// Запускает с позиции offset (с). Возвращает функцию остановки.
export function playMix(context, destination, { voice, music, duck, voiceGain = 1, musicGain = .9, own = false, offset = 0 }) {
  const nodes = []
  const now = context.currentTime + .03
  if (voice) {
    const source = context.createBufferSource()
    source.buffer = voice
    let tail = source
    if (own) {
      // Свой голос с телефона или ноутбука: убрать гул, добавить разборчивости, выровнять.
      const highpass = new BiquadFilterNode(context, { type: 'highpass', frequency: 85 })
      const presence = new BiquadFilterNode(context, { type: 'peaking', frequency: 3200, Q: 1, gain: 3 })
      const compressor = new DynamicsCompressorNode(context, { threshold: -24, ratio: 3.5, attack: .005, release: .12, knee: 6 })
      tail.connect(highpass).connect(presence).connect(compressor)
      tail = compressor
      nodes.push(highpass, presence, compressor)
    }
    const gain = new GainNode(context, { gain: own ? voiceGain * 1.6 : voiceGain })
    tail.connect(gain).connect(destination)
    source.start(now, offset)
    nodes.push(source, gain)
  }
  if (music) {
    const source = context.createBufferSource()
    source.buffer = music
    const gain = new GainNode(context, { gain: musicGain })
    if (duck) {
      const from = Math.floor(offset / .05)
      const rest = duck.slice(from).map((value) => value * musicGain)
      if (rest.length > 1) gain.gain.setValueCurveAtTime(rest, now, Math.max(.1, rest.length * .05))
    }
    source.connect(gain).connect(destination)
    source.start(now, offset)
    nodes.push(source, gain)
  }
  return () => nodes.forEach((node) => { try { node.stop?.() } catch { /* уже остановлен */ } node.disconnect() })
}

// Тот же звук, но сразу в файл (для «Скачать звук»).
export async function renderMix(options, duration) {
  const offline = new OfflineAudioContext(2, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE)
  playMix(offline, offline.destination, options)
  return offline.startRendering()
}

export function wavBlob(buffer) {
  const channels = buffer.numberOfChannels
  const length = buffer.length * channels * 2
  const view = new DataView(new ArrayBuffer(44 + length))
  const text = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
  text(0, 'RIFF'); view.setUint32(4, 36 + length, true); text(8, 'WAVE'); text(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true)
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, length, true)
  const data = [...Array(channels)].map((_, c) => buffer.getChannelData(c))
  let offset = 44
  for (let i = 0; i < buffer.length; i += 1) {
    for (let c = 0; c < channels; c += 1) {
      const sample = Math.max(-1, Math.min(1, data[c][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([view], { type: 'audio/wav' })
}

// Записи своих фраз храним в браузере (IndexedDB), чтобы перезагрузка страницы
// их не стёрла. На сервер ничего не уходит.
const DB = 'logos-promo'
const STORE = 'takes'
function db() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function tx(mode, run) {
  const base = await db()
  return new Promise((resolve, reject) => {
    const transaction = base.transaction(STORE, mode)
    const result = run(transaction.objectStore(STORE))
    transaction.oncomplete = () => resolve(result?.result)
    transaction.onerror = () => reject(transaction.error)
  })
}
export async function loadTakes() {
  try {
    const base = await db()
    return await new Promise((resolve) => {
      const out = {}
      const cursor = base.transaction(STORE).objectStore(STORE).openCursor()
      cursor.onsuccess = () => { const item = cursor.result; if (!item) { resolve(out); return } out[item.key] = item.value; item.continue() }
      cursor.onerror = () => resolve(out)
    })
  } catch { return {} }
}
export const saveTake = (id, blob) => tx('readwrite', (store) => store.put(blob, id)).catch(() => {})
export const deleteTake = (id) => tx('readwrite', (store) => store.delete(id)).catch(() => {})

// Сборка ролика в браузере: видео без звука рисуется на холст, звук — тот же
// микс, всё записывается MediaRecorder в реальном времени (около 40 с).
export function recordVideo({ videoUrl, mix, duration, onProgress }) {
  return new Promise((resolve, reject) => {
    const type = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((item) => window.MediaRecorder?.isTypeSupported?.(item))
    if (!type) { reject(new Error('Этот браузер не умеет записывать видео. Откройте панель в Chrome или Edge.')); return }
    const video = document.createElement('video')
    video.src = videoUrl
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720
    const paint = canvas.getContext('2d')
    const context = new AudioContext({ sampleRate: SAMPLE_RATE })
    const destination = context.createMediaStreamDestination()
    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...destination.stream.getAudioTracks()])
    const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 5_000_000 })
    const chunks = []
    let stop = () => {}
    let frame = 0
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
    recorder.onstop = () => { cancelAnimationFrame(frame); stop(); context.close(); resolve(new Blob(chunks, { type: type.split(';')[0] })) }
    const draw = () => {
      paint.drawImage(video, 0, 0, 1280, 720)
      onProgress?.(Math.min(1, video.currentTime / duration))
      if (!video.ended) frame = requestAnimationFrame(draw)
    }
    video.onended = () => { paint.drawImage(video, 0, 0, 1280, 720); window.setTimeout(() => recorder.stop(), 250) }
    video.onerror = () => reject(new Error('Не удалось открыть видео ролика.'))
    video.oncanplaythrough = async () => {
      video.oncanplaythrough = null
      await context.resume()
      recorder.start(500)
      stop = playMix(context, destination, mix)
      await video.play()
      draw()
    }
    video.load()
  })
}

export const extensionFor = (blob) => (blob.type.includes('mp4') ? 'mp4' : 'webm')
