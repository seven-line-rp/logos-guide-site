// Внешняя проверка сайта: открывает главную, подгружает файлы сборки, смотрит
// ИИ-эндпоинт и срок сертификата. Запускается по расписанию в GitHub Actions
// (.github/workflows/uptime.yml), то есть снаружи хостинга: если хостинг лёг,
// сам сайт про это не расскажет. При падении и при восстановлении шлёт
// сообщение в Telegram (deploy/alerts.md). Без зависимостей, нужен Node 18+.
//
// Переменные окружения:
//   SITE_URL — адрес сайта (https://…), обязательна;
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID — куда писать (можно не задавать: тогда
//     о падении сообщит сам GitHub письмом о неудачном запуске);
//   PREVIOUS_CONCLUSION — итог предыдущего запуска (success/failure): так не
//     приходит новое сообщение каждые 5 минут, пока сайт лежит;
//   CHECK_API=0 — не проверять api/ai-chat.php (если сайт без PHP).

import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import tls from 'node:tls'

export const SLOW_MS = 8000
export const CERT_WARN_DAYS = 14

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function get(fetchImpl, url, { timeoutMs = 15000 } = {}) {
  const started = Date.now()
  const response = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'LogosUptime/1.0', 'Cache-Control': 'no-cache' } })
  const text = await response.text()
  return { status: response.status, type: response.headers.get('content-type') || '', text, ms: Date.now() - started }
}

// Сколько дней осталось до даты окончания сертификата (строка вида «Jan 1 00:00:00 2027 GMT»).
export function daysUntil(validTo, now = Date.now()) {
  const time = Date.parse(validTo)
  return Number.isFinite(time) ? Math.floor((time - now) / 86400000) : null
}

// Одна проверка сайта. down — сайт недоступен или сломан; warnings — не критично.
export async function checkSite({ siteUrl, fetchImpl = fetch, checkApi = true, slowMs = SLOW_MS }) {
  const base = siteUrl.replace(/\/+$/, '')
  const down = []
  const warnings = []
  let ms = 0
  try {
    const home = await get(fetchImpl, `${base}/`)
    ms = home.ms
    if (home.status !== 200) down.push(`главная отвечает ${home.status}`)
    else if (!/id=["']root["']/.test(home.text)) down.push('на главной нет приложения (не тот index.html)')
    else {
      // Файлы сборки: главная без них — белый экран, хотя сервер отвечает 200.
      const assets = [...new Set([...home.text.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/g)].map((match) => match[1]))]
      if (!assets.length) down.push('в index.html нет ссылок на /assets (сборка залита не полностью)')
      for (const asset of assets.slice(0, 6)) {
        const file = await get(fetchImpl, `${base}${asset}`)
        if (file.status !== 200 || /text\/html/i.test(file.type) || !file.text.length) down.push(`файл ${asset} недоступен (${file.status})`)
      }
    }
    if (ms > slowMs) warnings.push(`главная открывается медленно: ${(ms / 1000).toFixed(1)} с`)
  } catch (error) {
    down.push(`сайт не отвечает (${error.name === 'TimeoutError' ? 'таймаут' : error.cause?.code || error.message})`)
  }
  if (checkApi && !down.length) {
    try {
      const api = await get(fetchImpl, `${base}/api/ai-chat.php?health`)
      if (api.status === 404) warnings.push('ИИ-эндпоинт не найден: не залита папка api')
      else if (api.status !== 200) warnings.push(`ИИ-эндпоинт отвечает ${api.status}`)
      else {
        let body = null
        try { body = JSON.parse(api.text) } catch { /* не JSON */ }
        if (!body) warnings.push('ИИ-эндпоинт отвечает не JSON: хостинг не выполняет PHP?')
        else if (body.ok !== true) warnings.push('ИИ-чат не настроен: нет ключа DeepSeek или расширения curl')
      }
    } catch (error) {
      warnings.push(`ИИ-эндпоинт не отвечает (${error.name === 'TimeoutError' ? 'таймаут' : error.message})`)
    }
  }
  return { down, warnings, ms }
}

// Несколько попыток подряд: один обрыв связи не считается падением сайта.
export async function checkWithRetries(options, { attempts = 3, pauseMs = 20000, wait = sleep } = {}) {
  let result
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    result = await checkSite(options)
    if (!result.down.length) return { ...result, attempts: attempt }
    if (attempt < attempts) await wait(pauseMs)
  }
  return { ...result, attempts }
}

export function certificateDaysLeft(host, port = 443) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port, servername: host, timeout: 8000 }, () => {
      const cert = socket.getPeerCertificate()
      socket.end()
      resolve(cert?.valid_to ? daysUntil(cert.valid_to) : null)
    })
    socket.on('error', () => resolve(null))
    socket.on('timeout', () => { socket.destroy(); resolve(null) })
  })
}

// Что делать по итогам проверки и итогу прошлого запуска.
export function decide({ result, previous = '', certDays = null, digest = false }) {
  const warnings = [...result.warnings]
  if (certDays !== null && certDays < CERT_WARN_DAYS) warnings.push(certDays < 0 ? 'сертификат HTTPS просрочен' : `сертификат HTTPS закончится через ${certDays} дн.`)
  if (result.down.length) {
    // Сообщаем один раз, когда сайт упал (прошлый запуск был успешным или первый).
    return { status: 'down', notify: previous !== 'failure', warnings }
  }
  if (previous === 'failure') return { status: 'recovered', notify: true, warnings }
  // Предупреждения (медленно, ИИ, сертификат) собираем в одно сообщение в день.
  return { status: 'ok', notify: digest && warnings.length > 0, warnings }
}

export function formatMessage({ status, result, warnings, siteUrl }) {
  const site = siteUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (status === 'down') return `🚨 ЛОГОС: сайт не работает\n${site}\n${result.down.map((line) => `• ${line}`).join('\n')}\nПроверено ${result.attempts || 1} раз(а) подряд. Проверьте хостинг и последнюю заливку сайта.`
  if (status === 'recovered') return `✅ ЛОГОС: сайт снова работает\n${site}\nГлавная открывается за ${(result.ms / 1000).toFixed(1)} с.${warnings.length ? `\nНо есть замечания:\n${warnings.map((line) => `• ${line}`).join('\n')}` : ''}`
  return `⚠️ ЛОГОС: замечания по сайту\n${site}\n${warnings.map((line) => `• ${line}`).join('\n')}`
}

export async function sendTelegram({ token, chat, text, fetchImpl = fetch }) {
  const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`Telegram ответил ${response.status}`)
}

export async function main(env = process.env) {
  const siteUrl = (env.SITE_URL || '').trim()
  if (!siteUrl) {
    console.log('SITE_URL не задан (Settings → Secrets and variables → Actions → Variables): проверка пропущена.')
    return 0
  }
  const result = await checkWithRetries({ siteUrl, checkApi: env.CHECK_API !== '0' })
  const host = new URL(siteUrl).hostname
  const certDays = siteUrl.startsWith('https:') ? await certificateDaysLeft(host) : null
  const now = new Date()
  const digest = now.getUTCHours() === 6 && now.getUTCMinutes() < 10
  const decision = decide({ result, previous: env.PREVIOUS_CONCLUSION || '', certDays, digest })
  const text = formatMessage({ status: decision.status, result, warnings: decision.warnings, siteUrl })

  const summary = [`### ${decision.status === 'down' ? '🚨 Сайт не работает' : '✅ Сайт работает'}`, '', `Адрес: ${siteUrl}`, `Главная: ${(result.ms / 1000).toFixed(1)} с, попыток: ${result.attempts}`, certDays !== null ? `Сертификат: ещё ${certDays} дн.` : '', ...result.down.map((line) => `- 🔴 ${line}`), ...decision.warnings.map((line) => `- 🟡 ${line}`)].filter((line) => line !== '').join('\n')
  console.log(summary)
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${summary}\n`)

  if (decision.notify && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try { await sendTelegram({ token: env.TELEGRAM_BOT_TOKEN, chat: env.TELEGRAM_CHAT_ID, text }) } catch (error) { console.log(`::warning::Не удалось отправить в Telegram: ${error.message}`) }
  } else if (decision.notify) {
    console.log('::notice::Telegram не настроен (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID): о падении сообщит только письмо от GitHub.')
  }
  // Код 1 помечает запуск неудачным: GitHub пришлёт письмо, а следующий запуск узнает, что сайт лежал.
  return decision.status === 'down' ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code), (error) => { console.error(error); process.exit(1) })
}
