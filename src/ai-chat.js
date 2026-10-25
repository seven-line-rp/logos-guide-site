import { functionalStorageAllowed } from './consent.js'
import { calloutKind, cleanReply, parseChartSpec, splitSubject } from './ai-format.js'
import { parseNextSpec, parseQuizSpec } from './ai-quiz.js'

// Клиентская часть ИИ-агента: запрос к public/api/ai-chat.php, хранение
// чатов в браузере, маскировка мата и разбор ответа. Ответ модели — Markdown,
// но в страницу он попадает только как текст и ссылки: HTML из ответа не
// исполняется. Единственное исключение — формулы: их превращает в вёрстку KaTeX
// (trust: false), он сам экранирует всё лишнее.

export const AI_ENDPOINT = '/api/ai-chat.php'
export const MAX_HISTORY = 20
export const MAX_INPUT = 4000
export const MAX_IMAGES = 3
export const CHATS_KEY = 'logos-ai-chats'
export const MAX_CHATS = 30

const IMAGE_NOTE = '[к сообщению было приложено изображение]'

// Картинки уходят в модель только из последнего вопроса: старые снимки
// заменяются пометкой, чтобы не платить за них в каждом запросе.
export function historyForRequest(messages) {
  const turns = messages
    .filter((message) => (message.role === 'user' || message.role === 'assistant') && !message.error)
    .slice(-MAX_HISTORY)
  return turns.map(({ role, content, images, sig }, index) => {
    // Ответ агента уходит целиком и с подписью сервера: по ней сервер отличает
    // настоящие ответы от подделанных. Вопросы человека обрезаются до MAX_INPUT.
    const text = role === 'assistant' ? String(content || '') : String(content || '').slice(0, MAX_INPUT)
    const item = { role, content: text }
    if (role === 'assistant' && sig) item.sig = sig
    if (images?.length) {
      if (index === turns.length - 1) item.images = images.slice(0, MAX_IMAGES)
      else item.content = `${text}\n${IMAGE_NOTE}`.trim()
    }
    return item
  })
}

export async function askAgent(messages, { signal, deep = false, study = false, fetchImpl = fetch } = {}) {
  let response
  try {
    response = await fetchImpl(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Logos-Client': 'web' },
      body: JSON.stringify({ messages: historyForRequest(messages), deep, study }),
      signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new Error('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.')
  }
  const data = await response.json().catch(() => null)
  if (response.ok && typeof data?.reply === 'string') {
    const question = messages[messages.length - 1]?.content || ''
    return { reply: cleanReply(data.reply, question), sig: typeof data.sig === 'string' ? data.sig : '', reasoning: typeof data.reasoning === 'string' ? cleanReply(data.reasoning, question) : '', vision: data.vision !== false, left: Number.isFinite(data.left) ? data.left : null }
  }
  if (data?.error) throw Object.assign(new Error(data.detail ? `${data.error} (${data.detail})` : data.error), { left: Number.isFinite(data.left) ? data.left : null })
  if (response.status === 404) throw new Error('ИИ-агент ещё не загружен на этот сервер.')
  if (response.status === 413) throw new Error('Картинки слишком большие. Попробуйте одну или поменьше.')
  if (response.ok) throw new Error('Сервер ИИ ответил не в том формате (возможно, ошибка PHP на хостинге). Сообщите команде сайта.')
  if (response.status === 403) throw new Error('Сервер отклонил запрос (код 403). Обновите страницу; если не помогло, сообщите команде сайта.')
  if (response.status >= 500) throw new Error(`Сервер ИИ вернул ошибку (код ${response.status}). Попробуйте позже; если повторяется, сообщите команде сайта.`)
  throw new Error(`ИИ не ответил (код ${response.status}). Попробуйте ещё раз.`)
}

// ---------- Мат ----------
// Сообщение с матом уходит в модель замаскированным («б***»): агент отвечает
// по существу, а грубые слова не попадают ни в запрос, ни в историю.
// Корни проверяются с начала слова (с приставками), поэтому «оскорблять»,
// «употреблять», «небо», «себя» и «мудрый» не срабатывают.

const lookalikes = { a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у', 3: 'з', 0: 'о', 6: 'б', '@': 'а' }
const prefix = '(?:о|за|на|по|от|вы|при|у|до|раз|рас|об|под|пере|недо|про|с|из|въ|съ|долбо|долба)?ъ?'
const roots = [
  'ху[йеияю]', 'пи[зс]д', 'пезд', 'еб(?:а|у|л|н|ыв|ись|ет|ош|ок|ук)', 'еб$', 'бля', 'муд[аои]к', 'мудил', 'пид[оа]?р', 'залуп', 'г[ао]ндон',
  'шлюх', 'дроч', 'манд(?:а|ой|у|ы|ец|юк)$', 'хер(?:ня|ни|ню|ов[а-я]*|а|ну|ом)?$', 'сук(?:а|и|у|ой|ам|ами)?$', 'сучк', 'сучар',
]
const profanityPattern = new RegExp(`^${prefix}(?:${roots.join('|')})`)

function normalizeWord(word) {
  return [...word.toLocaleLowerCase('ru')].map((char) => lookalikes[char] || char).join('').replace(/ё/g, 'е').replace(/(.)\1{2,}/g, '$1')
}

export function containsProfanity(text) {
  const words = String(text || '').toLocaleLowerCase('ru').split(/[^a-zа-яё0-9@*]+/i).filter(Boolean)
  return words.some((word) => {
    const normalized = normalizeWord(word.replace(/\*/g, ''))
    return profanityPattern.test(normalized)
  })
}

// В истории чата мат показываем замаскированным: «б***».
export function maskProfanity(text) {
  return String(text || '').replace(/[a-zа-яё0-9@*]+/gi, (word) => containsProfanity(word) ? `${word[0]}${'*'.repeat(Math.max(2, word.length - 1))}` : word)
}

// ---------- Чаты в localStorage ----------

export function createChat(now = Date.now()) {
  return { id: `c${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, title: 'Новый чат', created: now, updated: now, messages: [] }
}

export function chatTitle(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return 'Чат с картинкой'
  return clean.length > 42 ? `${clean.slice(0, 40).trimEnd()}…` : clean
}

function validMessage(message) {
  return message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string'
}

export function parseChats(raw) {
  try {
    const value = JSON.parse(raw || '')
    if (!value || value.v !== 1 || !Array.isArray(value.chats)) return { chats: [], activeId: '' }
    const chats = value.chats
      .filter((chat) => chat && typeof chat.id === 'string' && Array.isArray(chat.messages))
      .map((chat) => ({ ...chat, title: String(chat.title || 'Чат'), messages: chat.messages.filter(validMessage) }))
    return { chats, activeId: typeof value.activeId === 'string' ? value.activeId : '' }
  } catch {
    return { chats: [], activeId: '' }
  }
}

function storage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

export function loadChats(store = storage()) {
  try { return parseChats(store?.getItem(CHATS_KEY)) } catch { return { chats: [], activeId: '' } }
}

// Сохраняем только непустые чаты. Если место кончилось (у localStorage около
// 5 МБ), сначала убираем картинки из старых чатов, потом сами старые чаты.
export function saveChats(chats, activeId, store = storage()) {
  if (!store || !functionalStorageAllowed(store)) return 'disabled'
  let list = chats.filter((chat) => chat.messages.length).sort((a, b) => b.updated - a.updated).slice(0, MAX_CHATS)
    .map((chat) => ({ ...chat, messages: chat.messages.filter((m) => !m.pending).map(({ pending: _p, ...m }) => m) }))
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      store.setItem(CHATS_KEY, JSON.stringify({ v: 1, activeId, chats: list }))
      return attempt ? 'trimmed' : 'saved'
    } catch {
      const withImages = [...list].reverse().find((chat) => chat.messages.some((m) => m.images?.length))
      if (withImages) {
        list = list.map((chat) => chat === withImages ? { ...chat, messages: chat.messages.map(({ images, ...m }) => images?.length ? { ...m, content: `${m.content}\n${IMAGE_NOTE}`.trim() } : m) } : chat)
      } else if (list.length > 1) {
        list = list.slice(0, -1)
      } else {
        return 'full'
      }
    }
  }
  return 'full'
}

// ---------- Картинки ----------

// Сжимаем в браузере: до 1024 px по длинной стороне, JPEG. Так снимок
// расписания весит 100–200 КБ и помещается и в запрос, и в историю.
export async function compressImage(file, { maxSide = 1024, quality = 0.78 } = {}) {
  if (!file?.type?.startsWith('image/')) throw new Error('Это не картинка.')
  if (file.size > 15 * 1024 * 1024) throw new Error('Картинка больше 15 МБ.')
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Не удалось открыть картинку.'))
      element.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------- Разметка ответа ----------

// Безопасные ссылки: свои разделы (/map…) и внешние https-адреса.
export function safeHref(href) {
  const value = String(href || '').trim()
  if (/^\/(?!\/)/.test(value)) return { href: value, internal: true }
  if (/^https:\/\//i.test(value)) return { href: value, internal: false }
  return null
}

// Формулы: $…$ (без пробела после открывающего и перед закрывающим знаком, чтобы
// «5$ и 10$» не считалось формулой) и \(…\). Курсив: *текст* и _текст_.
const inlinePattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(https:\/\/[^\s)<]+[^\s)<.,!?;:])|`([^`]+)`|\$(?=\S)([^$\n]*?\S)\$(?!\d)|\\\(([^\n]+?)\\\)|(?<![\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/g

// Строка → список кусков: text, strong, code, link.
export function parseInline(text) {
  const parts = []
  let last = 0
  for (const match of text.matchAll(inlinePattern)) {
    if (match.index > last) parts.push({ type: 'text', text: text.slice(last, match.index) })
    if (match[1]) parts.push({ type: 'strong', text: match[1] })
    else if (match[5]) parts.push({ type: 'code', text: match[5] })
    else if (match[6] ?? match[7]) parts.push({ type: 'math', text: match[6] ?? match[7] })
    else if (match[8]) parts.push({ type: 'em', text: match[8] })
    else {
      const label = match[2] ?? match[4]
      const link = safeHref(match[3] ?? match[4])
      parts.push(link ? { type: 'link', text: label, ...link } : { type: 'text', text: label })
    }
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) })
  return parts
}

const tableRow = /^\s*\|.*\|\s*$/
const tableRule = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'))
}

// Текст → блоки: абзацы, заголовки, списки, цитаты-плашки, таблицы, формулы,
// графики (```chart) и блоки кода (```lang … ```).
export function parseBlocks(text) {
  const blocks = []
  let paragraph = []
  let code = null
  let math = null
  const flush = () => { if (paragraph.length) blocks.push({ type: 'p', text: paragraph.join(' ') }); paragraph = [] }
  const closeCode = () => {
    if (code.lang.toLowerCase() === 'chart') {
      const spec = parseChartSpec(code.text)
      blocks.push(spec ? { type: 'chart', spec } : { type: 'code', lang: 'json', text: code.text })
    } else if (code.lang.toLowerCase() === 'quiz') {
      const spec = parseQuizSpec(code.text)
      if (spec) blocks.push({ type: 'quiz', spec })
    } else if (code.lang.toLowerCase() === 'next') {
      const items = parseNextSpec(code.text)
      if (items) blocks.push({ type: 'next', items })
    } else blocks.push(code)
    code = null
  }
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]
    const fence = raw.trim().match(/^```\s*([\w+#.-]*)\s*$/)
    if (code) {
      if (fence && !fence[1]) closeCode(); else code.text += (code.text ? '\n' : '') + raw
      continue
    }
    if (math) {
      const end = raw.indexOf(math.close)
      if (end >= 0) { math.text += ` ${raw.slice(0, end)}`; blocks.push({ type: 'math', text: math.text.trim() }); math = null } else math.text += ` ${raw}`
      continue
    }
    if (fence) { flush(); code = { type: 'code', lang: fence[1], text: '' }; continue }
    const line = raw.trim()
    // Формула на отдельных строках: $$ … $$ или \[ … \].
    const display = line.match(/^(?:\$\$([\s\S]*)|\\\[([\s\S]*))$/)
    if (display) {
      flush()
      const close = line.startsWith('$$') ? '$$' : '\\]'
      const body = display[1] ?? display[2]
      const end = body.indexOf(close)
      if (end >= 0) blocks.push({ type: 'math', text: body.slice(0, end).trim() })
      else math = { close, text: body }
      continue
    }
    if (tableRow.test(line) && tableRule.test(lines[index + 1] || '')) {
      flush()
      const head = splitRow(line)
      const aligns = splitRow(lines[index + 1]).map((cell) => (cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : ''))
      const rows = []
      index += 2
      while (index < lines.length && tableRow.test(lines[index].trim())) { rows.push(splitRow(lines[index])); index += 1 }
      index -= 1
      blocks.push({ type: 'table', head, aligns, rows: rows.slice(0, 60) })
      continue
    }
    if (/^>\s?/.test(line)) {
      flush()
      const quote = []
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) { quote.push(lines[index].trim().replace(/^>\s?/, '')); index += 1 }
      index -= 1
      // Подпись плашки («**Важно:**») уходит в заголовок со значком, а не в текст.
      const titled = quote[0].match(/^\*\*([^*]+?)\*\*:?\s*(.*)$/) || quote[0].match(/^([А-Яа-яЁёA-Za-z ]{3,24}):\s*(.*)$/)
      const label = titled ? titled[1].replace(/[:\s]+$/, '') : ''
      if (titled) { if (titled[2]) quote[0] = titled[2]; else quote.shift() }
      blocks.push({ type: 'callout', kind: calloutKind(label), label, blocks: parseBlocks(quote.join('\n')) })
      continue
    }
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) { flush(); blocks.push({ type: 'hr' }); continue }
    const bullet = line.match(/^[-*•]\s+(.*)$/)
    const numbered = line.match(/^\d+[.)]\s+(.*)$/)
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (!line) { flush(); continue }
    if (bullet || numbered) {
      flush()
      const type = bullet ? 'ul' : 'ol'
      const previous = blocks[blocks.length - 1]
      if (previous?.type === type) previous.items.push((bullet || numbered)[1])
      else blocks.push({ type, items: [(bullet || numbered)[1]] })
      continue
    }
    if (heading) { flush(); blocks.push({ type: 'h', text: heading[1] }); continue }
    paragraph.push(line)
  }
  flush()
  // Модель могла оборвать ответ внутри блока кода или формулы: показываем то, что есть.
  if (code) closeCode()
  if (math) blocks.push({ type: 'math', text: math.text.trim() })
  return blocks
}

// Кнопки-действия под ответом: маршрут и место на карте из ссылок в тексте.
export function answerActions(text) {
  const actions = []
  const seen = new Set()
  for (const part of parseBlocks(splitSubject(text).text).filter((block) => ['p', 'h', 'ul', 'ol'].includes(block.type)).flatMap((block) => block.items || [block.text]).flatMap(parseInline)) {
    if (part.type !== 'link' || !part.internal || seen.has(part.href)) continue
    const kind = part.href.startsWith('/route') ? 'route' : part.href.startsWith('/map') ? 'map' : ''
    if (!kind) continue
    seen.add(part.href)
    actions.push({ kind, href: part.href, label: part.text })
  }
  return actions.slice(0, 6)
}

// Ссылка маршрута из ответа ИИ → откуда, куда и вариант перехода.
export function routeFromLink(href) {
  const match = String(href || '').match(/^\/route\?(.*)$/)
  if (!match) return null
  const params = new URLSearchParams(match[1])
  const to = params.get('to')
  if (!to) return null
  return { from: params.get('from') || 'entrance-1', to, mode: params.get('mode') || 'auto' }
}

// Текст без Markdown: для копирования и озвучки.
export function plainText(text) {
  const flat = (blocks) => blocks.map((block) => {
    const line = (value) => parseInline(value).map((part) => part.text).join('')
    if (block.type === 'code') return block.text
    if (block.type === 'math') return block.text
    if (block.type === 'chart') return block.spec.title ? `[график: ${block.spec.title}]` : '[график]'
    if (block.type === 'hr') return ''
    if (block.type === 'table') return [block.head, ...block.rows].map((row) => row.map(line).join(' | ')).join('\n')
    if (block.type === 'callout') return [block.label ? `${block.label}:` : '', flat(block.blocks)].filter(Boolean).join(' ')
    if (block.type === 'quiz') return ['Задания:', ...block.spec.tasks.map((task, i) => `${i + 1}. ${line(task.q)}`)].join('\n')
    if (block.type === 'next') return ''
    if (block.items) return block.items.map((item) => `— ${line(item)}`).join('\n')
    return line(block.text)
  }).filter((part) => part !== '').join('\n')
  return flat(parseBlocks(splitSubject(text).text))
}

export function chatToMarkdown(chat) {
  const lines = [`# ${chat.title}`, '', `ЛОГОС AI · ${new Date(chat.created).toLocaleString('ru-RU')}`, '']
  for (const message of chat.messages) {
    const who = message.role === 'user' ? 'Вы' : 'ЛОГОС AI'
    lines.push(`**${who}:** ${message.content}${message.images?.length ? `\n_(картинок: ${message.images.length})_` : ''}`, '')
  }
  return lines.join('\n')
}
