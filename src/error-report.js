// Сообщаем серверу о сбоях страницы (api/client-error.php): белый экран после
// неудачного обновления сайта, не загрузившиеся файлы, падения в React. Сервер
// отправляет оповещение владельцу, только если сбои массовые. В запросе — тип,
// короткий текст ошибки, имя файла и путь страницы без параметров; без адреса,
// имени и других данных посетителя. Только в рабочей сборке.

export const ERROR_ENDPOINT = '/api/client-error.php'
const MAX_REPORTS = 3
const RELOAD_KEY = 'logos-chunk-reload'

// Шум, который к сайту не относится: расширения браузера, чужие скрипты, безвредные предупреждения.
const IGNORED = /ResizeObserver loop|Script error\.?$|Non-Error promise rejection|AbortError|The operation was aborted|Load failed$|NetworkError when attempting to fetch|chrome-extension|moz-extension/i
const CHUNK = /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically imported|Unable to preload CSS|ChunkLoadError/i

export function classify(message) {
  return CHUNK.test(String(message)) ? 'chunk' : 'error'
}

export function shouldReport(message, source = '', origin = '') {
  const text = String(message || '')
  if (!text || IGNORED.test(text)) return false
  // Ошибка из чужого файла (расширение, сторонний скрипт) — не наша.
  if (source && origin && !source.startsWith(origin)) return false
  return true
}

const seen = new Set()
let sent = 0

export function reportError(kind, error, source = '', fetchImpl = typeof fetch === 'function' ? fetch : null) {
  const message = String(error?.message || error || '').slice(0, 200)
  const key = `${kind}|${message}`
  if (!fetchImpl || sent >= MAX_REPORTS || seen.has(key)) return false
  if (!shouldReport(message, source, typeof location === 'undefined' ? '' : location.origin)) return false
  seen.add(key)
  sent += 1
  try {
    fetchImpl(ERROR_ENDPOINT, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', 'X-Logos-Client': 'web' },
      body: JSON.stringify({ k: kind, m: message, s: source, p: typeof location === 'undefined' ? '/' : location.pathname }),
    }).catch(() => {})
  } catch { /* связи нет — сообщать некуда */ }
  return true
}

// Старая вкладка после обновления сайта просит файл, которого уже нет: один раз
// тихо перезагружаем страницу (раз в 10 минут), чтобы человек не увидел белый экран.
function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    if (Date.now() - last < 600000) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    window.location.reload()
    return true
  } catch { return false }
}

export function installErrorReporting() {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (event) => {
    const kind = classify(event.message)
    reportError(kind, event.message, event.filename || '')
  })
  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || event.reason
    reportError(classify(message) === 'chunk' ? 'chunk' : 'promise', message)
  })
  // Vite присылает это событие, когда не удалось подгрузить файл раздела.
  window.addEventListener('vite:preloadError', (event) => {
    reportError('chunk', event.payload?.message || 'vite:preloadError')
    if (reloadOnce()) event.preventDefault()
  })
}
