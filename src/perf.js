// Режим «Лёгкий»: на слабых устройствах (интерактивные доски, старые телефоны,
// экономия трафика) сайт выключает размытие, тени, бесконечные анимации и
// 3D-сцены. Режим ставится атрибутом <html data-perf="lite"> ещё до первой
// отрисовки (main.jsx); все правила лежат в perf.css.
//
// Как определяем слабое устройство:
//   1. ?perf=lite или ?perf=full в адресе — ручной выбор, запоминается;
//   2. мало памяти (deviceMemory ≤ 2 ГБ) или ядер (≤ 2), «Экономия трафика»;
//   3. замер частоты кадров в первые секунды: если средний кадр дольше 36 мс
//      (меньше ~28 к/с), включаем лёгкий режим на время этой вкладки.

export const PERF_KEY = 'logos-perf'
const SESSION_KEY = 'logos-perf-auto'

export function isWeakDevice({ memory, cores, saveData } = {}) {
  if (saveData) return true
  if (Number.isFinite(memory) && memory <= 2) return true
  if (Number.isFinite(cores) && cores <= 2) return true
  return false
}

// Среднее время кадра в мс по списку отметок времени.
export function averageFrameMs(stamps) {
  if (stamps.length < 2) return 0
  return (stamps[stamps.length - 1] - stamps[0]) / (stamps.length - 1)
}

export function isSlowFrames(stamps, limitMs = 36) {
  return stamps.length >= 20 && averageFrameMs(stamps) > limitMs
}

function read(store, key) {
  try { return window[store].getItem(key) } catch { return null }
}

function write(store, key, value) {
  try { window[store].setItem(key, value) } catch { /* приватный режим: просто не запоминаем */ }
}

export function perfMode() {
  return document.documentElement.dataset.perf === 'lite' ? 'lite' : 'full'
}

export function isLitePerf() {
  return typeof document !== 'undefined' && perfMode() === 'lite'
}

function setMode(mode) {
  if (mode === 'lite') document.documentElement.dataset.perf = 'lite'
  else delete document.documentElement.dataset.perf
  window.dispatchEvent(new Event('logos-perf'))
}

export function applyPerfMode() {
  if (typeof window === 'undefined') return
  const asked = new URLSearchParams(window.location.search).get('perf')
  if (asked === 'lite' || asked === 'full') write('localStorage', PERF_KEY, asked)
  const saved = read('localStorage', PERF_KEY)
  if (saved === 'lite' || saved === 'full') { setMode(saved); return }
  const nav = navigator
  const weak = isWeakDevice({ memory: nav.deviceMemory, cores: nav.hardwareConcurrency, saveData: nav.connection?.saveData })
  if (weak || read('sessionStorage', SESSION_KEY) === 'lite') { setMode('lite'); return }
  watchFrameRate()
}

// Замер: 2 секунды после загрузки. Вкладка в фоне кадры не отдаёт, поэтому
// замер прерывается, если страница скрыта.
function watchFrameRate() {
  const start = () => {
    const stamps = []
    let ended = false
    const finish = () => {
      ended = true
      if (isSlowFrames(stamps)) { write('sessionStorage', SESSION_KEY, 'lite'); setMode('lite') }
    }
    const tick = (now) => {
      if (ended) return
      if (document.hidden) { ended = true; return }
      stamps.push(now)
      if (now - stamps[0] >= 2000) finish()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
  if (document.readyState === 'complete') window.setTimeout(start, 600)
  else window.addEventListener('load', () => window.setTimeout(start, 600), { once: true })
}

// Выполняется при первом импорте, раньше остальных модулей сайта (interactions.js
// читает режим сразу). В тестах Node окна нет — тогда ничего не делаем.
applyPerfMode()
